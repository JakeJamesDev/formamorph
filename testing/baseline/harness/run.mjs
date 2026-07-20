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
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const BASELINE_DIR = path.resolve(HARNESS_DIR, "..");
const DEFAULT_WORLD = "sedge-landing.json";
const RUNS_DIR = path.resolve(HARNESS_DIR, "../runs");
// Prompt presets seeded into FORMAMORPH_promptPresets. A profile picks one with `"promptArm": "neutral"`
// (the probe's stripped B-arm) or `"promptPreset": "<file>.json"` (any preset file in this dir — e.g.
// screen-preset.json, which keeps the shipped prompt text but pins samplers explicitly). Neither → the
// built-in Default preset stays active.
const loadPreset = async (file) => JSON.parse(await readFile(path.join(HARNESS_DIR, file), "utf8"));
const NEUTRAL_PRESET = await loadPreset("neutral-preset.json");
const presetCache = new Map();
async function presetFor(profile) {
  if (profile.promptArm === "neutral") return NEUTRAL_PRESET;
  if (!profile.promptPreset) return null;
  if (!presetCache.has(profile.promptPreset)) presetCache.set(profile.promptPreset, await loadPreset(profile.promptPreset));
  return presetCache.get(profile.promptPreset);
}
// A fixed port made runs collide: `npm run dev` under shell:true spawns vite as a GRANDCHILD, so killing the
// npm wrapper orphaned the real server. The next run then failed to bind ("port already in use"), silently
// attached to the stale orphan instead, and died mid-turn with "Execution context was destroyed" as soon as
// another run's cleanup killed the server out from under it. Now: claim a free port per run, and spawn vite
// directly so kill() reaches it.
let PORT = 0;
let BASE_URL = "";

/** An OS-assigned free port. Bind to 0, read the port, release it, hand it to vite (--strictPort). */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

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

// Per-model endpoint overrides let one matrix span multiple servers (e.g. a model that won't load in Ollama
// routed to LM Studio): a model entry may carry its own endpointUrl/apiToken, else the top-level cfg applies.
// A model with `modelPath` instead drives the DESKTOP APP'S OWN engine (electron/llmEngine.cjs) — see below.
const ENGINE_PORT = 8977;
const engineUrl = (port) => `http://127.0.0.1:${port}/v1/chat/completions`;
const modelEndpoint = (cfg, model) =>
  model.modelPath ? engineUrl(model.enginePort ?? ENGINE_PORT) : (model.endpointUrl ?? cfg.endpointUrl);
const modelToken = (cfg, model) => (model.modelPath ? "" : model.apiToken ?? cfg.apiToken ?? "");

// The built-in engine is a plain Node module (no Electron): it loads a GGUF via node-llama-cpp and serves an
// OpenAI-compatible endpoint on 127.0.0.1. Driving it here is the only way to screen a catalog model the way
// the desktop build actually runs it — notably the `<think>` re-wrapping, which an external server does not
// do (a reasoning model's answer otherwise arrives as bare chain-of-thought). Single model at a time: always
// stopEngine() before starting the next.
const require_ = createRequire(import.meta.url);
let engine = null;

// KV cache per engine-loaded model. The scripted profiles peak around 5.4k tokens on their last turn (measured
// across a full screen dump), so this is headroom, not a limit — a prompt that fits sees an identical context
// either way. It is deliberately not larger: the KV competes with the weights for VRAM, and reserving 16k made
// 19GB-class models fail to load on a 24GB card once the harness browser took its share. Raise per model with
// `contextSize` in profiles.json if a profile ever outgrows it.
const ENGINE_CONTEXT_SIZE = 8192;

async function startEngine(model) {
  engine ??= require_(path.join(REPO_ROOT, "electron", "llmEngine.cjs"));
  const port = model.enginePort ?? ENGINE_PORT;
  console.log(`  loading ${path.basename(model.modelPath)} into the built-in engine (port ${port})…`);
  await engine.start({ modelPath: model.modelPath, port, contextSize: model.contextSize ?? ENGINE_CONTEXT_SIZE });
  for (let i = 0; i < 240 && engine.getState().status === "loading"; i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  const s = engine.getState();
  if (s.status !== "ready") throw new Error(`built-in engine failed to load: ${s.error ?? s.status}`);
  return s;
}

async function stopEngine() {
  if (!engine) return;
  try { await engine.stop(); } catch { /* already down */ }
}

// Warm up a model before the scripted turns: on a single GPU, requesting a model that isn't loaded triggers a
// load (evicting the previous one), and the request that triggers it comes back truncated. A throwaway 1-token
// call absorbs that load so the first real turn hits a fully-loaded model.
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

function buildSeed(cfg, model, profile, preset) {
  // An engine model is driven exactly as the desktop build drives it: custom-endpoint OFF, so the app
  // resolves its own `localModelActive` path — desktop sampler block (top_p/top_k/min_p) and, crucially,
  // `thinking_budget_tokens` instead of the coarse `reasoning_effort`. That reasoning-budget cap is the only
  // way a reasoning model's thought segment gets bounded; without it the model can spend an entire narration
  // inside <think> and emit nothing. Turning the flag on requires faking the desktop bridge (see
  // desktopBridgeScript) AND that the engine sits on the app's hard-coded local port.
  const asDesktop = Boolean(model.modelPath);
  if (asDesktop && (model.enginePort ?? ENGINE_PORT) !== ENGINE_PORT) {
    throw new Error(`engine model ${model.label} must use port ${ENGINE_PORT}: the desktop path targets a hard-coded ${ENGINE_PORT}`);
  }
  const seed = {
    // Custom endpoint OFF for engine models → the desktop local-model path (endpoint hard-codes localhost:8977,
    // where the engine runs). Ollama models keep it ON and point at their own URL.
    FORMAMORPH_useCustomEndpoint: asDesktop ? "false" : "true",
    FORMAMORPH_endpointUrl: modelEndpoint(cfg, model),
    FORMAMORPH_apiToken: modelToken(cfg, model),
    // The built-in engine serves the model under its GGUF basename, so an engine model needs no modelName.
    FORMAMORPH_modelName: model.modelPath ? path.basename(model.modelPath) : model.modelName,
  };
  for (const [k, v] of Object.entries(profile.settings ?? {})) {
    seed[`FORMAMORPH_${k}`] = serialize(v);
  }
  // Activate a prompt preset when the profile asked for one (neutral B-arm, or a named preset file such as
  // screen-preset.json). Absent → the built-in Default preset stays active.
  if (preset) {
    seed.FORMAMORPH_promptPresets = JSON.stringify({ activeId: preset.id, presets: [preset] });
  }
  return seed;
}

async function waitForServer(url, timeoutMs = 60000, hasExited = () => false) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // If vite died (e.g. it couldn't bind), stop: a responder on this port would be someone else's server,
    // and attaching to it is what produced mid-run "Execution context was destroyed" failures.
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

async function runOne(browser, cfg, model, profile) {
  const label = `${profile.name} x ${model.label}`;
  console.log(`\n▶ ${label} — launching`);
  const context = await browser.newContext();
  const seed = buildSeed(cfg, model, profile, await presetFor(profile));
  // For engine models, present a desktop build to the app: `isDesktop()` keys off window.formamorphDesktop,
  // and the local-model path only reports reachable if the `.llm` bridge says a model is loaded. The real
  // engine runs Node-side (startEngine) and serves HTTP on 8977; this bridge just reports 'ready' so the app
  // unblocks and takes its desktop request path. Injected before any app module evaluates (addInitScript), so
  // DEFAULT_ENDPOINT — computed from isDesktop() at import time — resolves to the local engine.
  if (model.modelPath) {
    const modelId = path.basename(model.modelPath);
    await context.addInitScript(({ modelId, port }) => {
      const ready = { status: "ready", modelPath: modelId, modelId, port, error: null, contextSize: null, gpuLayers: null, flashAttention: null, parallelRequests: 1, maxContextSize: null, engineVramMB: null };
      const P = (v) => Promise.resolve(v);
      window.formamorphDesktop = {
        // A no-op net-fetch bridge so isDesktop()-gated fetches don't throw; real chat requests go over HTTP.
        fetch: (opts) => fetch(opts.url, { headers: opts.headers }),
        llm: {
          status: () => P(ready), onStatus: () => () => {},
          listModels: () => P([modelId]), listInstalled: () => P([{ fileName: modelId, sizeBytes: 0 }]),
          modelsDir: () => P(""), load: () => P(ready), stop: () => P(ready), setOptions: () => P(ready),
          download: () => P({ path: modelId }), cancelDownload: () => P(true), onDownloaded: () => () => {},
        },
      };
    }, { modelId, port: ENGINE_PORT });
  }
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
  // Worlds with embedded images pop an "Optimize imported images?" dialog before the world card renders.
  const keepAsIs = page.getByRole("button", { name: "Keep as-is" });
  await keepAsIs.click({ timeout: 5000 }).catch(() => {});
  await page.getByRole("button", { name: /Enter World/i }).click();

  // Advance the enter-world steps (defaults pre-selected) until the game mounts and __baseline registers.
  // Each step's primary button is labeled with the NEXT step's name (Traits→Characters→Dictionaries→Start),
  // so click whichever advance label is present this iteration. Richer worlds (a character library, a
  // dictionary choice) chain more steps than Sedge's traits-only flow.
  const ADVANCE = ["Next", "Location", "Characters", "Dictionaries", "Avatar", "Start", "Continue", "Random", "Skip"];
  for (let i = 0; i < 24; i++) {
    if (await page.evaluate(() => Boolean(window.__baseline))) break;
    for (const name of ADVANCE) {
      const btn = page.getByRole("button", { name, exact: true });
      if (await btn.count()) { await btn.first().click().catch(() => {}); break; }
    }
    await page.waitForTimeout(500);
  }
  if (!(await page.evaluate(() => Boolean(window.__baseline)))) {
    throw new Error(`${label}: window.__baseline never registered (did the game screen mount?)`);
  }

  // Warm up (load) this model before the real turns — critical on a single GPU where switching models evicts
  // the previous one and the load-triggering request comes back truncated.
  console.log(`  warming up ${model.modelName}…`);
  await warmUp(cfg, model);

  // Drive the turns: a `dynamic` profile picks each action live via a chooser model reading the latest
  // narration + choices; otherwise the fixed script runs as one batch.
  const plannedTurns = profile.dynamic ? profile.dynamic.turns : profile.script.length;
  if (profile.dynamic) {
    await runDynamic(page, profile.dynamic);
  } else {
    console.log(`  running ${profile.script.length} actions…`);
    await page.evaluate((actions) => window.__baseline.runScript(actions), profile.script);
  }
  // Settle: let async digest/diary drainers (if any) flush before we snapshot. Per-profile override wins
  // — the summary profile needs far longer than the default so every turn's digest drains.
  await page.waitForTimeout(profile.settleMs ?? cfg.settleMs ?? 4000);

  const dump = await page.evaluate(() => window.__baseline.getDebugTurns());
  await context.close();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(RUNS_DIR, `${profile.name}-${model.label}-${stamp}.json`);
  await writeFile(file, JSON.stringify(dump, null, 2), "utf8");
  const ok = Array.isArray(dump) && dump.length === plannedTurns;
  console.log(`  ${ok ? "✔" : "⚠"} ${dump?.length ?? 0}/${plannedTurns} turns → ${path.relative(REPO_ROOT, file)}`);
}

// ---- Dynamic mode: a chooser model plays the player character live ----
// Each turn: read the latest narration + offered choices from the debug dump, ask the chooser (cloud default
// endpoint — free, no VRAM contention with the game model) for the next player action, send it via the same
// __baseline.runScript path as scripted mode. Falls back to the first offered choice if the chooser balks.
const CHOOSER_ENDPOINT = "https://api.lyonade.net/v1/chat/completions";
async function chooseAction(goal, narration, choices, turnNo, total) {
  const sys = `You control the player character in a text adventure session run by an automated game-engine test harness. ${goal}\n\nReply with ONLY the player's next action: first person, one or two sentences, concrete. No commentary, no quotes around the whole line.`;
  const user = `Turn ${turnNo} of ${total}.\n\nLatest scene:\n${narration}\n\nOffered choices (you may pick one or write your own action):\n${choices || "(none)"}`;
  try {
    const res = await fetch(CHOOSER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "default",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        max_tokens: 120, temperature: 0.7, stream: false,
      }),
    });
    const j = await res.json();
    const out = (j.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
    // A refusal/meta reply instead of an action → fall back to the first offered choice.
    if (!out || /as an ai|i can'?t assist|i cannot|language model/i.test(out)) throw new Error("chooser balked");
    return out.split("\n")[0].slice(0, 300);
  } catch {
    const first = (choices || "").split("\n").map((l) => l.replace(/^\s*\d+[).\s-]*/, "").trim()).find(Boolean);
    return first || "I continue.";
  }
}

async function runDynamic(page, dyn) {
  console.log(`  dynamic mode: ${dyn.turns} turns, chooser on cloud default…`);
  for (let t = 0; t < dyn.turns; t++) {
    let action = "START GAME";
    if (t > 0) {
      const last = await page.evaluate(() => {
        const turns = window.__baseline.getDebugTurns();
        const turn = turns[turns.length - 1];
        const grab = (ty) => turn?.requests?.find((r) => r.type === ty)?.response ?? "";
        return { narration: grab("narration"), choices: grab("choices") };
      });
      action = await chooseAction(dyn.goal, last.narration, last.choices, t + 1, dyn.turns);
    }
    console.log(`  [${t + 1}/${dyn.turns}] ${action.slice(0, 100)}`);
    await page.evaluate((a) => window.__baseline.runScript([a]), action);
  }
}

async function main() {
  const profilesPath = path.join(HARNESS_DIR, "profiles.json");
  if (!existsSync(profilesPath)) {
    throw new Error("profiles.json not found — copy profiles.example.json to profiles.json and fill it in.");
  }
  const cfg = JSON.parse(await readFile(profilesPath, "utf8"));
  await mkdir(RUNS_DIR, { recursive: true });

  // Substring filter, but an exact label wins when one exists — otherwise `--model foo` also matches `foo-q6`
  // (a label that is a prefix of another), silently screening the wrong quant and mixing its dumps into the row.
  const exact = modelFilter ? cfg.models.filter((m) => m.label === modelFilter) : [];
  const models = !modelFilter ? cfg.models : exact.length ? exact : cfg.models.filter((m) => m.label.includes(modelFilter));
  const profiles = cfg.profiles.filter((p) => !profileFilter || p.name === profileFilter);
  if (!models.length || !profiles.length) throw new Error("No models/profiles matched the filters.");

  PORT = await freePort();
  BASE_URL = `http://localhost:${PORT}`;
  console.log(`Starting dev server on ${BASE_URL} …`);
  // Spawn vite's own entry with this node binary — no npm wrapper, no shell — so `dev` IS the server process
  // and kill() actually stops it (see the PORT comment above for what the wrapper cost us).
  const dev = spawn(process.execPath, [path.join(REPO_ROOT, "node_modules", "vite", "bin", "vite.js"), "--port", String(PORT), "--strictPort"], {
    cwd: REPO_ROOT,
    stdio: "ignore",
    // Disable HMR/file-watching for the harness's server (see vite.config.js): a developer editing source
    // during a long scripted run then can't trigger a page reload that kills the turn under it.
    env: { ...process.env, BASELINE_NO_WATCH: "1" },
  });
  let devExited = false;
  dev.on("exit", () => { devExited = true; });
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
    await waitForServer(BASE_URL, 60000, () => devExited);
    const browser = await chromium.launch();
    try {
      for (let run = 1; run <= repeat; run++) {
        if (repeat > 1) console.log(`\n===== seed run ${run}/${repeat} =====`);
        for (const model of models) {
          // A `modelPath` model runs on the desktop engine: load it once for this model's profiles, then
          // unload before the next model (the engine holds one model at a time).
          if (model.modelPath) {
            try {
              await startEngine(model);
            } catch (err) {
              console.error(`  ✖ ${model.label}: ${err.message}`);
              await stopEngine();
              continue;
            }
          }
          try {
            for (const profile of profiles) {
              try {
                await runOne(browser, cfg, model, profile);
              } catch (err) {
                console.error(`  ✖ ${profile.name} x ${model.label}: ${err.message}`);
              }
            }
          } finally {
            if (model.modelPath) await stopEngine();
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
