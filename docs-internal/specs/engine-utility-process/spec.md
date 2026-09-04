# Spec: Move the Bundled Engine Off the Main Process

Status: ready-for-agent

## Problem Statement

Playing with the Built-In Engine lags the whole desktop app far more than running the same model
externally in LM Studio. Measured cause: the engine runs inside Electron's main process, whose Node
event loop is also the app's window message pump. Every AI request synchronously re-resolves the
model's chat template (~250–430ms) when constructing its chat session, freezing the entire app; a
game turn fires up to ~10 requests, so players feel repeated ~300ms freezes throughout every turn.
Model loads add several 150–290ms freezes, and generation burns 70–92% of a core inside the main
process. A native crash in the engine today also takes down the whole app.

## Solution

Two changes, independently shippable, together reaching parity with an external server:

1. **Pre-resolve the chat wrapper.** Resolve the model's chat template once at load time and hand
   the resolved wrapper to every per-request chat session. Measured: session construction drops
   from ~300ms to ~0ms.
2. **Host the engine in an Electron `utilityProcess`.** The engine module (model lifecycle + its
   localhost OpenAI server) moves into a child process. The renderer already talks to the engine
   over localhost HTTP, so only control traffic (start/stop/status) crosses IPC. The main process
   keeps a thin proxy exposing the engine's existing API surface so its call sites are unchanged.
   No inference work, callbacks, or SSE writes ever touch the UI message pump again.

## User Stories

1. As a desktop player, I want the app to stay responsive while the AI is generating, so that scrolling, typing my next action, and opening panels never hitch mid-turn.
2. As a desktop player, I want loading or reloading a model to not freeze the window, so that changing engine settings doesn't feel like a crash.
3. As a desktop player, I want each AI request to start faster, so that time-to-first-token isn't padded by ~300ms of template re-parsing.
4. As a desktop player, I want a turn with many AI calls (planner, narration, characters, choices, stats) to feel as smooth as one call, so that heavier Thinking modes don't degrade the UI.
5. As a desktop player, I want an engine crash to show an error instead of closing the app, so that a bad model or a native fault costs me a reload, not my session.
6. As a desktop player, I want stopping the engine to reliably free its VRAM and RAM, so that switching to an external endpoint actually releases my GPU.
7. As a desktop player, I want the engine status line, the Engine Device readout, and load-progress behavior to look exactly as they do today, so that the move is invisible except for the smoothness.
8. As a desktop player, I want model download, move, and delete flows to keep working while the engine holds a model, so that library management is unaffected.
9. As a desktop player on a weaker machine, I want engine CPU work isolated from the UI process, so that generation contends less with rendering.
10. As a developer, I want the main process's engine API to keep its current shape, so that its existing call sites (load, stop, status, options, model-move flows, quit) don't change behavior.
11. As a developer, I want the control protocol between main and the engine child covered by a real round-trip test, so that a protocol regression fails CI without Electron.
12. As a developer, I want the engine child runnable under plain Node, so that probes and tests exercise the real code path headlessly.
13. As a developer, I want the app to survive and report an engine-child exit, so that crash loops are visible instead of silent.

## Implementation Decisions

- **Chat wrapper**: resolved once in the engine's start path right after the model loads, stored
  alongside the model handle, passed to every chat session construction. Disposed with the model.
  This rides inside the engine module, so it benefits both the current in-process engine and the
  child-hosted one — land it first as its own commit.
- **Child host**: a new thin host module wraps the existing engine module and bridges a message
  port to its exported API (start/stop/getState) plus its status-push subscription. The engine
  module itself is unchanged by the move (its API is already fully serializable state — by design
  from the recent device-readout work).
- **Transport shim**: the host speaks Electron's `parentPort` when present and falls back to Node's
  `process.send`/`message` events, so the same file runs under `utilityProcess.fork` in the app and
  `child_process.fork` in tests and probes.
- **Main-process proxy**: same API shape as the engine module today — async start/stop, sync
  getState, onStatus subscription. Sync getState is served from a state mirror updated by every
  status push and every start/stop reply, so existing synchronous call sites keep working.
- **Protocol**: request/reply messages carry a correlation id; status pushes are fire-and-forget.
  Replies always carry the full serializable engine state (the same object the status contract
  tests already pin).
- **Child lifecycle**: spawned on first start, killed on engine stop and on app quit. Kill-on-stop
  is deliberate: process death is the one guaranteed way to release VRAM and native memory, which
  is the entire purpose of stop in the auto-stop flow. Respawn cost (~1–2s backend init) is
  negligible against model load time.
- **Crash handling**: an unexpected child exit pushes an error state naming the exit code; the next
  start spawns a fresh child. No automatic respawn loop.
- **The localhost OpenAI server moves with the engine** into the child (it lives inside the engine
  module). The renderer's HTTP path is untouched; CORS headers already allow it.
- **Load-progress / options flows**: the existing set-options-then-restart and model-move flows in
  the main process call the proxy exactly as they called the engine; stop/start sequencing is
  preserved.
- **VRAM readout**: nvidia-smi collection stays in the main process. The per-process attribution
  ("Formamorph's own share") keys off the main process pid today; after the move the engine's VRAM
  belongs to the child pid, so attribution must consider the child's pid (reported in engine state)
  or keep relying on the engine's own allocation estimate. The Engine Device line is unaffected.
- **Packaging**: the electron files glob already ships everything under the electron directory, and
  the engine's native dependency is already asar-unpacked. Verify the child resolves its import
  from inside the packaged app on at least Windows before release.
- **Backend choice (CUDA vs Vulkan) is a settled prior decision**: the shipped app deliberately
  strips CUDA backends (see the builder config's comment) and runs Vulkan. Nothing in this spec
  changes backend selection.

## Testing Decisions

- Good tests here assert external behavior: what state the proxy reports, what pushes subscribers
  receive, what a client sees over HTTP — never which internal function ran.
- **Protocol round-trip (the one new seam, per user decision)**: vitest forks the real host module
  under plain Node, wires the real proxy to it, drives start with no model (error state), stop, and
  a subscriber, and asserts full-shape state replies, push delivery, and the sync mirror. Also
  covers unexpected child exit → error push.
- **Existing seam kept**: the engine state-shape contract test continues to run against the engine
  module directly, unchanged.
- **Prior art**: the electron `.test.mjs` suites (model scan, stream download) for plain-Node
  testing of electron-side modules; the state-shape test for the full-state contract.
- **Not CI-testable, verified by probe**: the actual stall removal needs a real model + GPU. The
  session-construction stall and event-loop gaps are verified with the existing lag probe
  (scratchpad) before/after; numbers go in the commit body. The wrapper pre-resolution has no
  model-free test — asserting "constructor received a wrapper option" would mirror implementation.
- **Manual desktop pass**: load a model in the packaged/dev desktop app, play a turn, confirm
  status line, device line, and auto-stop behave; confirm task manager shows the child appearing
  on load and exiting on stop.

## Out of Scope

- CUDA backend support / backend selection changes (settled prior decision; revisit separately).
- Any renderer-side changes beyond what VRAM self-attribution needs — no UI redesign.
- Compositor/GPU contention investigation (only relevant if jank survives this move; measure then).
- Electron-level e2e infrastructure (declined in seam review).
- The baseline harness's mocked desktop bridge (it fakes the renderer-facing API, which is
  unchanged).

## Further Notes

- Measurements motivating this spec (2026-08-26, 4B model, Vulkan on RTX 4090): per-request
  session construction 250–350ms synchronous, every request; resolveChatWrapper alone 433ms;
  pre-resolved construction 0ms; generation host CPU 70–92% of a core; idle clean; streaming gaps
  2–3ms; load-phase stalls up to ~290ms.
- The engine state was made fully serializable (device fields included, error branch preserved) in
  the device-readout change — that work is what makes the proxy/mirror design trivial.
- Landing order: wrapper fix (commit 1, instantly shippable), then the utilityProcess move
  (commit 2), then probe re-run + manual pass.
