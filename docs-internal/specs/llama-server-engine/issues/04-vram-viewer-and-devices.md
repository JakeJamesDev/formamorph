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
- Totals come from ticket 02's `--list-devices` parser, run once per device enumeration, never polled. Ticket 02 already moved the device picker, Auto's pick and the device names onto it (ruling T02-2).
- The process the viewer attributes to Formamorph is the `llama-server` process.
- The GPU bars stay on nvidia-smi, unchanged.

## Acceptance criteria

- [ ] Engine tests through the fake server: the share, free-at-load, total, device names and backend fill from recorded fixtures.
- [ ] The viewer's attributed process id is the `llama-server` process.
- [ ] On this PC, the Formamorph share is within a stated margin of the nvidia-smi delta across the load (the number goes in the landing).
- [ ] A frame of the Local Model panel with a model loaded, dark and light, 1280 wide: `.scratch/frames/vram-panel-dark.png`, `.scratch/frames/vram-panel-light.png`.
- [ ] Changelog fragment in `docs-internal/changelog.d/`.
