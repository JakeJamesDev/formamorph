# 04: VRAM Viewer and Devices

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: log-line parsing against recorded fixtures and rewiring known status fields; the design is settled.

## What to build

The VRAM viewer and the GPU device picker read from `llama-server` (spec: VRAM viewer, Process).

- The Formamorph share is the sum of the non-host model, KV, compute and output buffer sizes that `llama-server` logs at load, read as JSON log lines.
- The free-at-load figure comes from the "using device … MiB free" line.
- Device names, totals and the backend come from `--list-devices`, run once per device enumeration, never polled. The device picker and Auto's pick use it.
- The process the viewer attributes to Formamorph is the `llama-server` process.
- The GPU bars stay on nvidia-smi, unchanged.

## Acceptance criteria

- [ ] Engine tests through the fake server: the share, free-at-load, total, device names and backend fill from recorded fixtures.
- [ ] The device list for the picker comes from `--list-devices`, and a pinned device resolves by name.
- [ ] The viewer's attributed process id is the `llama-server` process.
- [ ] On this PC, the Formamorph share is within a stated margin of the nvidia-smi delta across the load (the number goes in the landing).
- [ ] A frame of the Local Model panel with a model loaded, dark and light, 1280 wide: `.scratch/frames/vram-panel-dark.png`, `.scratch/frames/vram-panel-light.png`.
- [ ] Changelog fragment in `docs-internal/changelog.d/`.
