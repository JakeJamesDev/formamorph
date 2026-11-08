# 06: CUDA Fallback And Failure Memory

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: extends the engine's start flow with a second GPU attempt and persistent state, against recorded failure fixtures.

## What to build

When the CUDA build fails to load, the player still gets a model. The start runs in this order: list the CUDA build's devices, load on CUDA, and on failure list the Vulkan build's devices and load on Vulkan, which keeps today's CPU fallback (Q12). The engine state gains a fallback flag and the CUDA error. The panel shows a one-line notice and Error Details with the CUDA error. If Vulkan fails too, the final error is Vulkan's, as today.

After a CUDA failure, the device records the failure with the tag and the driver version. Auto skips CUDA while the record matches, and the row says CUDA failed last time and offers Retry, which clears the record (Q19). A new tag or a new driver version clears it too.

Fixtures: record a CUDA load failure with the fixture recorder, for example a model too large for CUDA's limits or a forced bad argument. That needs a GPU window from the user, so ask the spec session before recording.

Changelog fragment under 👤 Added, folded into the CUDA entry when that is still unreleased.

## Acceptance criteria

- [ ] A recorded CUDA load failure falls back to Vulkan in the same start, the model loads, and the state carries the fallback flag and the CUDA error. (engine test)
- [ ] CUDA and Vulkan both failing reaches the CPU fallback, and the final error is Vulkan's.
- [ ] The notice and Error Details show the CUDA error. (Local Model panel test)
- [ ] After a failure, the next Auto start goes straight to Vulkan. Retry, a new tag, or a new driver version each lets Auto try CUDA again.
- [ ] A guard test fails when the failure record is ignored.
- [ ] Frames: `.scratch/frames/cuda-fallback-notice.png` and `.scratch/frames/cuda-failed-last-time.png`, each in light and dark.
