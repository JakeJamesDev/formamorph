// Fork-local baseline harness. Spawns the Vite dev server, drives the REAL app through the Sedge Landing
// script for each model x profile, and writes the AI-context dump to ../runs/. Relies on the DEV-only
// window.__baseline hook (src/lib/baselineTestHook.ts) which exists only when running the dev server.
//
// Usage:  node run.mjs [--profile A] [--model meromero-31b]   (filters are optional, repeatable-ish substrings)
// Prereq: `npm install` here, `npx playwright install chromium`, your local model server running, then fill
//         profiles.json (copy of profiles.example.json).

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const BASELINE_DIR = path.resolve(HARNESS_DIR, "..");
const DEFAULT_WORLD = "sedge-landing.json";
const RUNS_DIR = path.resolve(HARNESS_DIR, "../runs");
// The B-arm neutral prompt preset, seeded into FORMAMORPH_promptPresets when a profile sets
// `"promptArm": "neutral"`. Any other value (or absent) leaves the built-in Default preset active (A-arm).
const NEUTRAL_PRESET = JSON.parse(
  await readFile(path.join(HARNESS_DIR, "neutral-preset.json"), "utf8"),
);
const PORT = 5180;
const BASE_URL = `http://localhost:${PORT}`;

const args = process.argv.slice(2);
const argVal = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const profileFilter = argVal("--profile");
const modelFilter = argVal("--model");
const repeat = Math.max(1, parseInt(argVal("--repeat") ?? "1", 10) || 1);

// localStorage serialization: strings stored raw (stringCodec), everything else JSON (bool/int codecs).
const serialize = (v) => (typeof v === "string" ? v : JSON.stringify(v));

// Warm up a model before the scripted turns: on a single GPU, requesting a model that isn't loaded triggers a
// load (evicting the previous one), and the request that triggers it comes back truncated. A throwaway 1-token
// call absorbs that load so the first real turn hits a fully-loaded model.
// Per-model endpoint overrides let one matrix span multiple servers (e.g. a model that won't load in Ollama
// routed to LM Studio): a model entry may carry its own endpointUrl/apiToken, else the top-level cfg applies.
const modelEndpoint = (cfg, model) => model.endpointUrl ?? cfg.endpointUrl;
const modelToken = (cfg, model) => model.apiToken ?? cfg.apiToken ?? "";

async function warmUp(cfg, model) {
  const headers = { "Content-Type": "application/json" };
  const token = modelToken(cfg, model);
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    await fetch(modelEndpoint(cfg, model), {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model.modelName,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
    });
  } catch {
    /* a real failure will surface during the run */
  }
}

function buildSeed(cfg, model, profile) {
  const seed = {
    FORMAMORPH_useCustomEndpoint: "true",
    FORMAMORPH_endpointUrl: modelEndpoint(cfg, model),
    FORMAMORPH_apiToken: modelToken(cfg, model),
    FORMAMORPH_modelName: model.modelName,
  };
  for (const [k, v] of Object.entries(profile.settings ?? {})) {
    seed[`FORMAMORPH_${k}`] = serialize(v);
  }
  // B-arm: activate the neutral prompt preset so every AI call uses the stripped-down control wording and its
  // pin-neutralizing samplers. A-arm (default/absent) leaves the built-in Default preset active.
  if (profile.promptArm === "neutral") {
    seed.FORMAMORPH_promptPresets = JSON.stringify({
      activeId: NEUTRAL_PRESET.id,
      presets: [NEUTRAL_PRESET],
    });
  }
  return seed;
}

async function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
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

async function runOne(browser, cfg, model, profile) {
  const label = `${profile.name} x ${model.label}`;
  console.log(`\n▶ ${label} — launching`);
  const context = await browser.newContext();
  const seed = buildSeed(cfg, model, profile);
  await context.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);

  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(BASE_URL);

  // Import the world via the hidden file input (no OS dialog), then enter it. Per-profile `world` overrides
  // the Sedge Landing default (e.g. the gate profiles use blackrue-waystation.json).
  const worldPath = path.join(BASELINE_DIR, profile.world ?? DEFAULT_WORLD);
  await page.locator('input[type="file"]').first().setInputFiles(worldPath);
  await page.getByRole("button", { name: /Enter World/i }).click();

  // Advance the trait modal (defaults pre-checked) until the game mounts and __baseline registers.
  for (let i = 0; i < 12; i++) {
    if (await page.evaluate(() => Boolean(window.__baseline))) break;
    const start = page.getByRole("button", { name: "Start", exact: true });
    const next = page.getByRole("button", { name: "Next", exact: true });
    const skip = page.getByRole("button", { name: "Skip", exact: true });
    if (await start.count()) await start.first().click().catch(() => {});
    else if (await next.count()) await next.first().click().catch(() => {});
    else if (await skip.count()) await skip.first().click().catch(() => {});
    await page.waitForTimeout(400);
  }
  if (!(await page.evaluate(() => Boolean(window.__baseline)))) {
    throw new Error(`${label}: window.__baseline never registered (did the game screen mount?)`);
  }

  // Warm up (load) this model before the real turns — critical on a single GPU where switching models evicts
  // the previous one and the load-triggering request comes back truncated.
  console.log(`  warming up ${model.modelName}…`);
  await warmUp(cfg, model);

  // Drive the fixed script; runScript awaits each turn's synchronous requests.
  console.log(`  running ${profile.script.length} actions…`);
  await page.evaluate((actions) => window.__baseline.runScript(actions), profile.script);
  // Settle: let async digest/diary drainers (if any) flush before we snapshot. Per-profile override wins
  // — the summary profile needs far longer than the default so every turn's digest drains.
  await page.waitForTimeout(profile.settleMs ?? cfg.settleMs ?? 4000);

  const dump = await page.evaluate(() => window.__baseline.getDebugTurns());
  await context.close();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(RUNS_DIR, `${profile.name}-${model.label}-${stamp}.json`);
  await writeFile(file, JSON.stringify(dump, null, 2), "utf8");
  const ok = Array.isArray(dump) && dump.length === profile.script.length;
  console.log(`  ${ok ? "✔" : "⚠"} ${dump?.length ?? 0}/${profile.script.length} turns → ${path.relative(REPO_ROOT, file)}`);
}

async function main() {
  const profilesPath = path.join(HARNESS_DIR, "profiles.json");
  if (!existsSync(profilesPath)) {
    throw new Error("profiles.json not found — copy profiles.example.json to profiles.json and fill it in.");
  }
  const cfg = JSON.parse(await readFile(profilesPath, "utf8"));
  await mkdir(RUNS_DIR, { recursive: true });

  const models = cfg.models.filter((m) => !modelFilter || m.label.includes(modelFilter));
  const profiles = cfg.profiles.filter((p) => !profileFilter || p.name === profileFilter);
  if (!models.length || !profiles.length) throw new Error("No models/profiles matched the filters.");

  console.log(`Starting dev server on ${BASE_URL} …`);
  const dev = spawn("npm", ["run", "dev", "--", "--port", String(PORT), "--strictPort"], {
    cwd: REPO_ROOT,
    shell: true,
    stdio: "ignore",
  });
  const cleanup = () => {
    try {
      dev.kill();
    } catch {
      /* already gone */
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(1);
  });

  try {
    await waitForServer(BASE_URL);
    const browser = await chromium.launch();
    try {
      for (let run = 1; run <= repeat; run++) {
        if (repeat > 1) console.log(`\n===== seed run ${run}/${repeat} =====`);
        for (const model of models) {
          for (const profile of profiles) {
            try {
              await runOne(browser, cfg, model, profile);
            } catch (err) {
              console.error(`  ✖ ${profile.name} x ${model.label}: ${err.message}`);
            }
          }
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    cleanup();
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
