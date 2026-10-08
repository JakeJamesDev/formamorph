# 01: Trailer Workspace And Proof Render

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: new tooling with no precedent in the repo; the package layout, render command and scene contract set the shape for every later ticket.

Parent: [Trailer spec](../spec.md)

## What to build

A new `marketing/trailer/` package proves the whole pipeline end to end. It holds its own dependencies, config and scripts and never enters the root gates or the game bundle (Q5).

- Two compositions, wide (1920x1080) and tall (1080x1920), at 60 fps, 20 seconds (Q2, Q6). Both render from one command to MP4 with H.264 video. The outputs are gitignored.
- A scene contract: a scene takes a layout (wide or tall) and a duration in frames and places its own content for each layout. The two compositions share one timeline.
- Three scenes: a title card that starts from the look of the existing build-assets title card (wordmark, Lexend and Baloo 2, dark stage), and two UI frame scenes that take an existing store shot and move a camera over it (pan or zoom). One shared transition between scenes.
- Fonts load through Remotion's font loader, never a stylesheet link.
- Silent (Q4). No audio track.
- A short README in the package: how to install, preview in the Remotion studio, and render.

Rulings: Q1, Q2, Q4, Q5, Q6.

## Acceptance criteria

- [ ] One command renders both MP4s; the result reports each file at the expected resolution, 60 fps and 20 s.
- [ ] The wide and tall compositions share the same scene list and timeline.
- [ ] Title card scene uses Lexend and Baloo 2 through the Remotion font loader.
- [ ] Two frame scenes show a store shot with camera motion; one transition joins scenes.
- [ ] Root typecheck, lint, test and build are untouched and green; the package has its own scripts.
- [ ] Rendered video files are gitignored; source and the package README are tracked.
