# 09: Load Matrix and Smoke Test

Status: done
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

- [x] The load matrix passes on this PC, with the per-combination table in the landing. (18/18, table below)
- [x] The packaged-build smoke test passes, and no process holds VRAM after quit. (`smoke.mjs` then `afterQuit.mjs`: PASS, no `llama-server` process, GPU memory back at the idle figure)
- [x] A known-bad combination (quantized V with Flash Attention off, forced) is reported as a failure, which proves the script can fail. (`bad-v-q8-fa-off`: load failed, "exiting due to model loading error")
- [x] The run time of the matrix is in the landing. (1.4 min)

## Landed

Matrix: `node testing/llama-server-matrix/run.mjs --model models/Impish_LLAMA_V2-Q4_K_M.gguf` on the RTX 4090, pinned build b11829, Context Size 4096. **18/18 passed in 1.4 min.**

| Combination | Result | Seconds |
|---|---|---|
| baseline | PASS | 9.2 |
| fa-off | PASS | 5.4 |
| unified-off (2 Parallel Requests) | PASS | 7.8 |
| unified-on-np2 | PASS | 4.3 |
| kv-in-ram | PASS | 4.4 |
| k-q8-fa-off | PASS | 4.2 |
| layers-max | PASS | 3.7 |
| layers-custom-8 | PASS | 3.7 |
| k-f16-v-q8_0 | PASS | 3.9 |
| k-f16-v-q4_0 | PASS | 4.2 |
| k-q8_0-v-f16 | PASS | 4.0 |
| k-q8_0-v-q8_0 | PASS | 3.9 |
| k-q8_0-v-q4_0 | PASS | 4.0 |
| k-q4_0-v-f16 | PASS | 3.9 |
| k-q4_0-v-q8_0 | PASS | 3.8 |
| k-q4_0-v-q4_0 | PASS | 3.8 |
| device-Vulkan0 | PASS | 3.7 |
| bad-v-q8-fa-off (forced) | PASS (failed to load, as required) | 3.9 |

Smoke: `desktop:build`, then `smoke.mjs` drove `release/win-unpacked/Formamorph.exe` through its preload bridge: engine `ready` on Vulkan, 3541 MiB share, one chat turn answered (HTTP 200). After quit, `afterQuit.mjs` found no `llama-server` process and no held VRAM.

**Not verified**
- A crash of the packaged app was not tested (the README lists the step).
- The smoke test drives the bridge, not the Local Model panel clicks; no new app hook was added.
- Each matrix row checks whole-GPU use against a baseline (±400 MiB), since Windows GeForce has no per-process VRAM. A leak under 400 MiB passes; the process check still catches a surviving `llama-server`.
- The smoke test runs the unpacked build (`release/win-unpacked`), not the launcher-assembled install, and sends its chat turn straight to the engine port, not through the app's chat path.
- The forced-bad row proves the binary rejects the flags (`quantized V cache requires flash_attn`), not the app's own coercion (that is unit-tested in ticket 06).

**For you**
- The release skill's pin-bump step is not edited (`.claude/skills` is untracked). The matrix command sits in `release-step-4d.md` step 4 for ticket 12 to apply.
