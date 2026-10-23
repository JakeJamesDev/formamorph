# 02: Engine Core on llama-server

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a process supervisor with crash safety, router-mode lifecycle, and a fake-server test harness that every later ticket builds on.

## What to build

The desktop engine runs the bundled `llama-server` in router mode instead of node-llama-cpp (spec: Process, Settings → server arguments; Q1, Q4, Q6, Q9, Q17, Q25). The engine host keeps its public contract: `start(options)`, `stop()`, `getState()`, `onStatus()`, and the status shape the renderer reads.

- Spawn and supervise `llama-server` in router mode, pointed at the models folder. Load and unload the model through the router API.
- Read load progress from the router's status event stream. The status keeps its whole-percent `loadProgress`.
- Map the existing settings: Context Size → `-c`; GPU Layers Auto / Max / Custom → `-ngl auto` with fit on / `-ngl all` / `-ngl N`; GPU Device → resolve the stored name against `--list-devices` on each start, one pinning scheme only; Flash Attention → `-fa on` or `-fa off`; Parallel Requests → `-np N`, always passed.
- The process dies with the app, including on a crash (a Windows Job Object or the platform's equivalent).
- A failed GPU load retries once on the CPU, and the status names the CPU backend.
- Load errors are restated in the panel's setting names.
- Build the fake `llama-server` harness: an injected spawn stub that replays recorded router events and log lines and answers HTTP like the real server. Record its fixtures from a real run at the pinned tag. Later tickets add fixtures to it.

The chat path in this ticket forwards requests straight through. Ticket 03 adds the request shaping. node-llama-cpp stays installed until ticket 12 removes it.

## Acceptance criteria

- [x] Engine tests through the fake server: start → loading (with percent) → ready → stop, and the full status shape at each step. `llmEngine.test.mjs` "goes start → loading with percent → ready → stop".
- [x] Each existing setting produces its server argument, including Flash Attention off → `-fa off` and `-np` on every start. The "settings → server arguments" block; each row mutation-tested.
- [x] The router event name the pinned build emits is pinned by a test. "pins the router event name": the recorded b11829 run emits `status_change`, not the README's `model_status`.
- [x] A failed GPU load falls back to the CPU and reports it; a failed CPU load reports the error in setting names. The "CPU fallback and load errors" block, Linux's separate CPU build included.
- [x] Stop leaves no `llama-server` process. Killing the parent leaves none either (shown once on this PC, noted in the landing). Fake-server test, plus three hard kills on this PC; see Landed.
- [x] A real model loads on this PC through the app and answers one turn. Electron dev app from the worktree, loaded over its IPC; see Landed.
- [x] Changelog fragment in `docs-internal/changelog.d/`.

For you: load your usual model in the desktop app and play a turn; check the load bar moves and the reply reads normally.

## Landed

**Shown on this PC (RTX 4090, Impish Llama 3B Q4_K_M)**
- Through the app: Electron dev build, `llm.load` over IPC. Status went loading 0 → 20 → 40 → 58 → 79 → 99 → 100 → ready on Vulkan, then one chat request answered "Banana.".
- Killed the Electron main process with `taskkill /F`. After 4 s, no `llama-server` and no utility process were left.
- Killed the engine host alone, and its Node parent alone. Each time, no `llama-server` was left after 3 s.
- Stop through the proxy: 0.4–0.7 s, with no process left.

**Not verified**
- The POSIX supervisor (macOS, Linux): its tests skip on Windows, so CI's Linux run proves them. A probe under Git's `sh` showed the stdin-EOF path ending the server.
- Coverage: vitest's v8 report gives `llmEngine.cjs` 81.7% lines and 78.8% branches. It doesn't count `llamaServer.cjs`, which the engine loads through `require`. Mutation runs cover it instead: 20 mutations, each red on its own test.
- A router crash between the load and the front server's listen: the code holds and reports it, but no test drives that window.

**For you**
- Load your usual model in the desktop app and play a turn. Check that the load bar moves and the reply reads normally.
- Until ticket 03 lands, image parts go straight to the server, and the server doesn't strip them.
- The 01 changelog entry still says "The engine still runs node-llama-cpp." The next spec pass should edit that line.
