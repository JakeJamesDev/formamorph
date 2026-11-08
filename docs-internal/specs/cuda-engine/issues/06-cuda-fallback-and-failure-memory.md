# 06: CUDA Fallback And Failure Memory

Status: done
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

- [x] A recorded CUDA load failure falls back to Vulkan in the same start, the model loads, and the state carries the fallback flag and the CUDA error. (engine test) — "a failed CUDA load falls back to Vulkan in the same start…", over the CUDA kvFail recorded on the 4090 (`recorder --cuda`).
- [x] CUDA and Vulkan both failing reaches the CPU fallback, and the final error is Vulkan's. — "CUDA and Vulkan both failing reach the CPU fallback…": router order CUDA → Vulkan → CPU, final error equals a Vulkan-only start's.
- [x] The notice and Error Details show the CUDA error. (Local Model panel test) — "says a start fell back to Vulkan, and Error Details shows the CUDA error"; no notice on a CPU end.
- [x] After a failure, the next Auto start goes straight to Vulkan. Retry, a new tag, or a new driver version each lets Auto try CUDA again. — "failure memory" tests through `electron/cudaStart.cjs` (main's starts and Retry).
- [x] A guard test fails when the failure record is ignored. — mutation: deleting the `failed-last-time` branch in `engineBackend.cjs` turns "after a fallback, the next Auto start goes straight to Vulkan…" red.
- [x] Frames: `.scratch/frames/cuda-fallback-notice.png` and `.scratch/frames/cuda-failed-last-time.png`, each in light and dark. — Browser pane, stubbed desktop bridge, 1280×900.

## Landed

**Not verified**
- That the final error is Vulkan's and not CUDA's, by text: the recorded CUDA and Vulkan KV failures give the same sentence in setting names, so swapping the two errors passes the test.
- Main's backend choice for a start (`backendChoice`: device listings, nvidia-smi) has no harness; the failure-memory tests stand in for it with `backendForStart` plus the record.
- A real CUDA fallback inside the packaged app.
- The CUDA row's "failed last time" line reads the driver versions cached at its last refresh; a driver update shows once the panel reopens.

**For you**
- Read the notice and the failed-last-time lines: `.scratch/cuda-engine-06/frames/cuda-fallback-notice.png`, `cuda-fallback-notice-dark.png`, `cuda-failed-last-time.png`, `cuda-failed-last-time-dark.png`.
- The single-sentence hints end in a period, like the existing Backend reasons; the Writing Guide's "one sentence takes no period" rule may want a sweep across all of them.
