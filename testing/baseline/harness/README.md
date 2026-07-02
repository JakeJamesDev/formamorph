# Sedge Landing — automated baseline harness

Drives the **real** Formamorph app (dev build) through the fixed [`../sedge-landing.json`](../sedge-landing.json)
script for each **model × profile** and writes the AI-context dump to `../runs/`. No hand-clicking, no hand-typing,
no manual export — one command fills the whole matrix.

> It talks to the same client pipeline you play by hand, so the dumps are identical in shape to a manual Export
> and gradable against [`../BASELINE-TEST.md`](../BASELINE-TEST.md).

## How it works

1. Spawns the Vite **dev** server (`:5180`) — the dev build is required because it exposes the `window.__baseline`
   hook (`src/lib/baselineTestHook.ts`), which is dead-code-eliminated from production builds.
2. Per run: seeds the profile's settings into `localStorage` *before boot* (endpoint, model, all toggles),
   imports the world via the hidden file input, enters it, then calls `window.__baseline.runScript(script)` and
   reads `getDebugTurns()`.
3. Saves `../runs/<profile>-<model>-<timestamp>.json`.

## One-time setup

```bash
# from the repo root:
npm install                                    # pulls in playwright (root devDep)
npx playwright install chromium
cp testing/baseline/harness/profiles.example.json testing/baseline/harness/profiles.json   # then edit (gitignored)
```

In **`profiles.json`** set:
- `endpointUrl` / `apiToken` — your local OpenAI-compatible server (koboldcpp, LM Studio, tabbyAPI, …). Use the
  full chat-completions URL, e.g. `http://127.0.0.1:1234/v1/chat/completions`.
- each model's `modelName` — the id your server expects.

Start your local model server (the harness does **not** launch it).

## Run

```bash
# from the repo root:
npm run baseline                       # every model × every profile
npm run baseline -- --profile A        # just Profile A, all models
npm run baseline -- --model cydonia    # just the model whose label contains "cydonia"
```

Output lands in `testing/baseline/runs/` (gitignored). Each line reports `<turns>/<expected>` so an empty/short
run is obvious.

## Notes

- **Nondeterministic** by design — the script is fixed, the model output isn't. That's fine; runs are comparable.
- `settleMs` (in `profiles.json`) pads time after the last turn so Profile B's async digest/diary drainers flush
  before the snapshot.
- Model turns are slow; per-run wall time is minutes. The browser is headless.
- If `window.__baseline never registered` appears, the trait modal didn't advance to the game screen — check the
  world still loads by hand.
