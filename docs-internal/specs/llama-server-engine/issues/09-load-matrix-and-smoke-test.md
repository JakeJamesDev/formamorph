# 09: Load Matrix and Smoke Test

Status: ready-for-agent
Blocked by: 04, 05, 06, 07, 08, 13
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a test script against the real binary and a packaged run; the behaviors under test already exist.

## What to build

The merge bar's real-binary checks (spec: Testing Decisions, seam 3; Q12). They run outside the gates.

- A load-matrix script runs the real bundled `llama-server` on this PC. Each setting combination loads a small model and answers one request: K/V types, Flash Attention on and off, Unified KV Cache on and off, KV Cache in RAM, GPU Device Auto and pinned, and GPU Layers Auto, Max and Custom. It reports pass or fail per combination, and checks that no process holds VRAM after each stop.
- A packaged-build smoke test: the installed Windows build starts the engine, loads a model, answers a request, and leaves no `llama-server` process after quit.
- The script and the smoke-test steps are documented next to the other harnesses, and the `release` skill's pin-bump step runs them.

## Acceptance criteria

- [ ] The load matrix passes on this PC, with the per-combination table in the landing.
- [ ] The packaged-build smoke test passes, and no process holds VRAM after quit.
- [ ] A known-bad combination (quantized V with Flash Attention off, forced) is reported as a failure, which proves the script can fail.
- [ ] The run time of the matrix is in the landing.
