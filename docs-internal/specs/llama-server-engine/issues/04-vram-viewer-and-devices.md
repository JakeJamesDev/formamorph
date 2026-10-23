# 04: VRAM Viewer and Devices

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: log-line parsing against recorded fixtures and rewiring known status fields; the design is settled.

## What to build

The VRAM viewer and the GPU device picker read from `llama-server` (spec: VRAM viewer, Process).

- The Formamorph share is the sum of the non-host model, KV, compute and output buffer sizes that `llama-server` logs at load, read as JSON log lines.
- The free-at-load figure comes from the "using device … MiB free" line.
- Totals come from ticket 02's `--list-devices` parser, run once per device enumeration, never polled. Ticket 02 already moved the device picker, Auto's pick and the device names onto it (ruling T02-2).
- The process the viewer attributes to Formamorph is the `llama-server` process.
- The GPU bars stay on nvidia-smi, unchanged.

## Acceptance criteria

- [x] Engine tests through the fake server: the share, free-at-load, total, device names and backend fill from recorded fixtures. `llmEngine.test.mjs` "VRAM viewer fields from the load log": Auto, fit-off (`max`) and CPU fixtures re-recorded at `-lv 4`; each guard mutation-tested.
- [x] The viewer's attributed process id is the `llama-server` process. The model instance's (ruling T04-2): engine tests on Windows and under the POSIX shell; in the Electron app, `vramStats().selfPid` equaled `serverPid` and nvidia-smi's llama-server row.
- [x] On this PC, the Formamorph share is within a stated margin of the nvidia-smi delta across the load (the number goes in the landing). Within 1% for Impish 4B; see Landed for larger loads.
- [x] A frame of the Local Model panel with a model loaded, dark and light, 1280 wide: `.scratch/frames/vram-panel-dark.png`, `.scratch/frames/vram-panel-light.png`. Electron app under Playwright, 1280 CSS px (1600 px images at 125% scale).
- [x] Changelog fragment in `docs-internal/changelog.d/`.

## Landed

**Measured on this PC (RTX 4090, b11829, real engine)**
- Impish 4B Q4_K_M, 8192 context: share 3541 MiB vs nvidia-smi delta 3532 MiB on Auto (+0.25%), 3513 MiB on Max (+0.80%).
- Larger loads read higher than the delta. Qwen3.6 35B-A3B: share 20340 MiB vs delta 19400 MiB (+4.8%). Cydonia 24B Q6_K at 131072 context, Auto fit to 23 layers: share 22043 MiB vs delta 18848 MiB (+17%). The share equals llama.cpp's own fit figure (22042 MiB). Likely cause, unverified: the driver commits KV pages lazily, so the delta grows as the context fills.
- The free-at-load figure is Vulkan's: 23365 MiB free while nvidia-smi showed about 17.6 GB free with other apps running. The device line shows llama.cpp's view, not the bars'.
- `-lv 4` costs about 210 log lines per load and 20 per turn. The engine parses them as they arrive and keeps only the sums.
- Fit trials on Auto print no buffer lines, so a shrinking fit is not double-counted (Cydonia run above).
- Hybrid models log an `RS buffer size` line for their recurrent state; the share counts it with the KV.

**Not verified**
- The POSIX process listing (`ps -A -o pid= -o ppid= -o comm=`) runs on CI's Linux only. The macOS `comm` path form is assumed from the docs.
- Coverage: `llmEngine.cjs` 97.1% lines, 78.7% branches. The `llamaServer.cjs` figure (80.7% lines) is unreliable through `require`, as in ticket 02; mutations cover it.
- Feeding the tally only until the load ends saves work but has no test; nothing changes the result after load.

**For you**
- Load your usual model and open the Local Model panel. Check that the "Formamorph" line on the GPU bar looks plausible next to the bar.
- Spec pass: the share now counts RS buffers, and `deviceVramFreeMB`/`deviceVramTotalMB` sum the devices the instance used (T04-3).
