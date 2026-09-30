# 01: Open-speed profiling harness

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Contained tooling work with a known shape: a scratch harness already exists and needs a home and a stable output.

## What to build

A repeatable way to measure how fast Community Creations opens. It runs a production build in Playwright, opens the browser cold and warm, and reports main-thread cost. Tickets 02–04 use it for their before and after numbers.

The session that wrote the spec built a working version in its scratchpad. It serves an unminified production build, sets the age gate and intro keys, opens Community Creations cold and then warm, and reads a CDP CPU profile and a trace. Rebuild it here from this description; do not rely on the scratchpad.

## Acceptance criteria

- [ ] One command builds an unminified production bundle outside `dist/` and runs the harness.
- [ ] It reports, per open (cold, warm 1, warm 2): time until the window is visible, main-thread blocks over 50 ms, and the share of render time in tooltip frames.
- [ ] It runs at 1× and 4× CPU throttle.
- [ ] Block timing comes from a trace, not from a heartbeat under the CPU profiler. The profiler's first start adds a large false block.
- [ ] Baseline numbers from this machine are recorded in this ticket under `## Comments`.
- [ ] It lives in `testing/`, outside the four gates, with a short README line on how to run it.
