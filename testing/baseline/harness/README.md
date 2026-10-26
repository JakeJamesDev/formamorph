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
npm run baseline -- --model meromero    # just the model whose label contains "meromero"

# also record the Turn Pipeline parity fixture (one profile × one model):
npm run baseline -- --profile parity --model gemma4-e4b-cloud --parity testing/parity/turn-pipeline-parity.json
```

Output lands in `testing/baseline/runs/` (gitignored). Each line reports `<turns>/<expected>` so an empty/short
run is obvious. `--parity <file>` additionally writes the ordered AI request sequence to `<file>` (relative to
the repo root) — see [../../parity/README.md](../../parity/README.md) before re-recording the tracked fixture.

## Narration tool-call probe

Prepare the two exact cloud requests offline:

```bash
npm run probe:narration-tools
```

The command writes a review artifact under `testing/baseline/runs/narration-tool-call-probe/` and makes no
network requests. After the request is approved, `npm run probe:narration-tools -- --cloud` runs the four-trial
cloud batch. Set `FORMAMORPH_PROBE_TOKEN` only when the endpoint requires a bearer token; credentials are never
written to the evidence file.

Run the same bounded batch against a loaded LM Studio model with a fixed seed:

```bash
npm run probe:narration-tools -- --lm-studio <model-id>
```

This targets `http://127.0.0.1:1234/v1/chat/completions`, records the selected model and seed in every request,
and writes a separate `lm-studio-batch-*.json` evidence file.

## World probe

Plays a bundled world against an older revision of itself, in the real dev build, on the cloud endpoint.
Each world ticket of the bundled-worlds refresh uses it for its evidence.

```bash
npx vite-node testing/baseline/harness/world-probe.cli.ts -- --worlds drone --runs 5
```

🎮 **What a run is.** The probe imports one arm's world file, enters it with the default picks, plays the
opening, then plays the world's scripted actions (`world-probe-worlds.ts`). The app does the rest, exactly as
in play: prompts, sampler pins, the stat pass, choices, and every world, trait and entity script at its
timing. The probe only adds `reasoning_effort: "none"` to each request.

### Arms

| Flag | Meaning | Default |
|---|---|---|
| `--arms A,B` | Two or more arms. `worktree` is the file on disk; anything else is a git revision (`HEAD`, `HEAD~2`, a sha). | `worktree,2f45261a5` |
| `--worlds` | `all`, or world ids (file names in `src/defaultworlds/`). | `all` |
| `--runs` | Runs per arm. | `5` |
| `--endpoint` / `--model` | Where requests go. | the cloud default |
| `--out` | Output folder. | `testing/baseline/runs/world-probe/<time>/` |
| `--port` | The probe's own dev-server port. `WORLD_PROBE_PORT` sets it too. | a free port |

- 🔌 The probe always starts its own dev server from the checkout it runs in, so several worktrees can probe
  at once. A port already in use stops the run; it never attaches to another server. Port 5180 is refused:
  the launch config owns it.

- `2f45261a5` is the last commit before the expansion, so the default compares the new world with the old one. Pass `--arms worktree,ace2e0204` to compare against the world before the refresh.
- An old revision loads through the app's own import, so legacy fields migrate as they do for a player.
- Arms alternate run by run (A B, then B A), so each batch carries its own control. The cloud model drifts
  between batches, so compare arms only within one batch.
- Open Chat has no cast of its own. Both arms get the lead from `../open-chat-cards.json` at the starting
  location.
- Set `FORMAMORPH_PROBE_TOKEN` when the endpoint needs a bearer token. It is never written to the output.

### Output

- **Summary table** (printed, and `summary.md`): per world and arm, the turns played, empty narrations,
  turns with chat-template token leaks, reasoning leaks, unresolved placeholders, choices that parse, stat
  passes the app could apply, turns with a world red flag, and runs that errored.
- **Transcripts** (`transcripts/`): one file per run under a blind label (A, B). `key.json` maps the labels
  to arms. Score them against the [baseline rubric](../BASELINE-TEST.md) before you open the key.
- **Raw results** (`<world>.json`): every turn's requests, replies and scores.

### ✅ The Q8 pass bar

A refreshed world passes when all three hold in **one batch**:

1. **No structural regression.** No metric is worse on the new arm than on the old one.
2. **Rubric win.** The new arm's blind transcripts score higher on the baseline rubric.
3. **Five or more runs per arm** on the cloud endpoint.

Post the arms, run counts, summary table and rubric result in the ticket.

## Tool spill probe

Replays captured requests of one bundled world through the app's own tool loop, with the world's judgment Tool
offered or withheld. It counts native-reasoning spills, Tool calls and usable replies per arm.

```bash
npx vite-node testing/baseline/harness/world-probe.cli.ts -- --worlds rampage,emberwatch --arms worktree,HEAD --runs 1 --out .scratch/capture
npx vite-node testing/baseline/harness/tool-spill-probe.cli.ts -- --capture .scratch/capture/rampage.json --runs 10
npx vite-node testing/baseline/harness/tool-spill-probe.cli.ts -- --world emberwatch --capture .scratch/capture/emberwatch.json --runs 10
```

| World | Tool | Trigger |
|---|---|---|
| `rampage` | `log_landmark` | Spire Tower torn down (`tower`) |
| `emberwatch` | `offer_prayer` | a prayer at the chapel's brazier (`prayer`) |

| Flag | Meaning | Default |
|---|---|---|
| `--capture` | A world-probe `<world>.json`. Its first run's turns 1 and 2 supply the requests. | required |
| `--world` | The world whose Tool is offered, read from `src/defaultworlds/<world>.json`. | `rampage` |
| `--cases` | `vague`, `opening`, `<trigger>` (narration), `roar`, `<trigger>-choices` (choices), `vague-stat`, `opening-stat`, `<trigger>-stat` (stat pass). `opening-stat` is turn 1's stat request as captured. | Rampage `vague-stat,tower-stat`; Emberwatch `vague-stat,prayer-stat` |
| `--arms` | `none`, `tool`, `kwargs` (adds `chat_template_kwargs.enable_thinking: false`), `joint` (Tool and schema in one plain request). | `none,tool` |
| `--tool-file` | A JSON file whose `description` replaces the Tool's. | the world's wording |
| `--runs` / `--endpoint` / `--model` / `--out` | As in the world probe. | 5, the cloud default |

- 🧠 A **spill** is a `<|channel>thought` block or a known reasoning opener in any round's raw reply. A **leak**
  is one left in the final reply after the app strips reasoning.
- ✅ **Accepted** counts calls whose arguments the app's World Tool turn accepts, so the handler would run. A
  rejected call gets the app's own error back and writes nothing.
- Arms alternate run by run, so each batch carries its own control.

## Notes

- **Nondeterministic** by design — the script is fixed, the model output isn't. That's fine; runs are comparable.
- `settleMs` (in `profiles.json`) pads time after the last turn so Profile B's async digest/diary drainers flush
  before the snapshot.
- Model turns are slow; per-run wall time is minutes. The browser is headless.
- If `window.__baseline never registered` appears, the trait modal didn't advance to the game screen — check the
  world still loads by hand.
