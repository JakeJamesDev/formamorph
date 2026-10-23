# 02: Engine Core on llama-server

Status: ready-for-agent
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

- [ ] Engine tests through the fake server: start → loading (with percent) → ready → stop, and the full status shape at each step.
- [ ] Each existing setting produces its server argument, including Flash Attention off → `-fa off` and `-np` on every start.
- [ ] The router event name the pinned build emits is pinned by a test.
- [ ] A failed GPU load falls back to the CPU and reports it; a failed CPU load reports the error in setting names.
- [ ] Stop leaves no `llama-server` process. Killing the parent leaves none either (shown once on this PC, noted in the landing).
- [ ] A real model loads on this PC through the app and answers one turn.
- [ ] Changelog fragment in `docs-internal/changelog.d/`.

For you: load your usual model in the desktop app and play a turn; check the load bar moves and the reply reads normally.
