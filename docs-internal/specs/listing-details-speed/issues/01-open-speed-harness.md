# 01: Open-speed profiling harness

Status: ready-for-human
Base: 568899fb
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Contained tooling work with a known shape: a scratch harness already exists and needs a home and a stable output.

## What to build

A repeatable way to measure how fast Community Creations opens. It runs a production build in Playwright, opens the browser cold and warm, and reports main-thread cost. Tickets 02–04 use it for their before and after numbers.

The session that wrote the spec built a working version in its scratchpad. It serves an unminified production build, sets the age gate and intro keys, opens Community Creations cold and then warm, and reads a CDP CPU profile and a trace. Rebuild it here from this description; do not rely on the scratchpad.

## Acceptance criteria

- [x] One command builds an unminified production bundle outside `dist/` and runs the harness.
- [x] It reports, per open (cold, warm 1, warm 2): time until the window is visible, main-thread blocks over 50 ms, and the share of render time in tooltip frames.
- [x] It runs at 1× and 4× CPU throttle.
- [x] Block timing comes from a trace, not from a heartbeat under the CPU profiler. The profiler's first start adds a large false block.
- [x] Baseline numbers from this machine are recorded in this ticket under `## Comments`.
- [x] It lives in `testing/`, outside the four gates, with a short README line on how to run it.

## Comments

**Run it:** `npm run profile:open-speed` ([testing/open-speed/](testing/open-speed/README.md)). About 47 s. Options: `OPEN_SPEED_ROWS`, `OPEN_SPEED_THROTTLE`, `OPEN_SPEED_SKIP_BUILD`.

**Baseline** (base `568899fb`, 700 synthetic catalog rows, this machine, headless Chromium):

| Throttle | Open | visibleMs | Blocks >50 ms | Blocked ms | Longest ms | Tooltip % of script |
|---|---|---|---|---|---|---|
| 1× | cold | 45 | 0 | 0 | 0 | 15.8 |
| 1× | warm 1 | 34 | 0 | 0 | 0 | 19.9 |
| 1× | warm 2 | 32 | 0 | 0 | 0 | 21.3 |
| 4× | cold | 266 | 5 | 784 | 266 | 14.6 |
| 4× | warm 1 | 242 | 8 | 870 | 226 | 17.3 |
| 4× | warm 2 | 225 | 7 | 725 | 213 | 16.7 |

Notes for tickets 02–04:

- `visibleMs` is click to the second animation frame after the dialog mounts. It waits behind any long task, so it counts blocking before the first paint.
- Tooltip share uses main-thread script time as the denominator. React's scheduler frames are minified in `node_modules`, so a "render time" match by name finds none.
- Block timing comes from `RunTask` events in a Tracing trace. No heartbeat runs under the profiler.
- This machine and these synthetic rows do not reproduce the spec's 272 ms warm open at 1×. The 4× numbers show the warm open still commits several long blocks. Compare before and after on the same machine.
- "Cold" is an empty catalog cache; warm 1 and warm 2 reload the page with the cache filled. The harness fails the run if a cold open starts with cached rows or a warm open starts with none.
- A block counts when it overlaps the open, so the click's own task is included. A throwaway trace runs before the cold open so the profiler's first start stays out of it.
- Run-to-run noise is real (one sample per open): 4× warm `visibleMs` read 172 in an earlier run and 242 here. Repeat runs before trusting a small difference.
