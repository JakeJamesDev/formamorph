// Drives the real dev build for the harnesses: one Vite dev server on a free port, and the import-and-enter
// flow that takes a world file to a mounted game screen with `window.__baseline` registered.
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

/** Bind `port` (0 for any), release it, and resolve the port bound. Rejects when the port is in use. */
function claimPort(port = 0) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(port, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs, hasExited) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // A responder after vite exits is another server; never attach to it.
    if (hasExited()) throw new Error("vite exited before the dev server came up — see its output");
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server did not come up on ${url} within ${timeoutMs}ms`);
}

/**
 * Start the dev build from `repoRoot` on a free port. Vite is spawned directly with this node binary, not
 * through npm under a shell, so `stop()` reaches the server itself and no orphan holds the port. File
 * watching is off (BASELINE_NO_WATCH), so an edit during a long run cannot reload the page under it.
 * `port` pins the port. A pinned port that is already in use throws, so a server this call did not start is
 * never reused.
 */
export async function startDevServer(repoRoot, pinned = 0) {
  const port = await claimPort(pinned).catch(() => {
    throw new Error(`Port ${pinned} is in use. Free it or pick another port.`);
  });
  const baseUrl = `http://localhost:${port}`;
  // localhost can resolve to ::1, which the bind above does not cover.
  if (await fetch(baseUrl).then(() => true, () => false)) throw new Error(`Port ${port} is in use. Free it or pick another port.`);
  const dev = spawn(process.execPath, [path.join(repoRoot, "node_modules", "vite", "bin", "vite.js"), "--port", String(port), "--strictPort"], {
    cwd: repoRoot,
    stdio: "ignore",
    env: { ...process.env, BASELINE_NO_WATCH: "1" },
  });
  let exited = false;
  dev.on("exit", () => { exited = true; });
  const stop = () => {
    try {
      dev.kill();
    } catch {
      /* already gone */
    }
  };
  process.on("exit", stop);
  process.on("SIGINT", () => {
    stop();
    process.exit(1);
  });
  try {
    await waitForServer(baseUrl, 60000, () => exited);
  } catch (err) {
    stop();
    throw err;
  }
  return { baseUrl, stop };
}

// Each enter step's primary button is labeled with the NEXT step's name, so whichever advance label is present
// gets clicked. "Got It" first: the contest popup overlays the enter dialog.
const ADVANCE = ["Got It", "Next", "Location", "Characters", "Dictionaries", "Avatar", "Start Game", "Start", "Continue", "Random", "Skip"];

/** Import `worldPath` through the hidden file input, enter it with the default picks, and wait for the game
 *  screen's `window.__baseline`. Throws with what is on screen when the game never mounts. */
export async function enterWorld(page, worldPath, label) {
  await page.locator('input[type="file"]').first().setInputFiles(worldPath);
  // Worlds with embedded images pop an "Optimize imported images?" dialog before the world card renders.
  await page.getByRole("button", { name: "Keep as-is" }).click({ timeout: 5000 }).catch(() => {});
  await page.getByRole("button", { name: /Enter World/i }).click();
  for (let i = 0; i < 24; i++) {
    if (await page.evaluate(() => Boolean(window.__baseline))) return;
    // A world's Introduction opens over the enter dialog and hides its buttons until it closes.
    const intro = page.getByRole("dialog", { name: "Introduction" }).getByRole("button", { name: "Close" });
    if (await intro.count()) {
      await intro.first().click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
    for (const name of ADVANCE) {
      const btn = page.getByRole("button", { name, exact: true });
      if (await btn.count()) { await btn.first().click().catch(() => {}); break; }
    }
    await page.waitForTimeout(500);
  }
  if (await page.evaluate(() => Boolean(window.__baseline))) return;
  const seen = await page.evaluate(() => ({
    buttons: [...document.querySelectorAll("button")].map((b) => b.textContent?.trim()).filter(Boolean).slice(0, 30),
    dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].map((d) => d.textContent?.trim().slice(0, 300)),
  }));
  throw new Error(`${label}: window.__baseline never registered (did the game screen mount?)\n  buttons: ${JSON.stringify(seen.buttons)}\n  dialogs: ${JSON.stringify(seen.dialogs)}`);
}
