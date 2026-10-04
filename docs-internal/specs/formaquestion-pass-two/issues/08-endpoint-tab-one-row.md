# 08: Endpoint tab one row, editor follows Answer

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Endpoint tab is short and has one way to pick a route.

- Answer and Pick render in one row of two route fields. Pick keeps Same as Answer.
- The editor below loses its select. It edits the preset the Answer route resolves to, under a heading that names it; with Follow Active it edits the active preset and the heading says so. Add copies that preset and moves Answer to the copy. Delete, where the shared editor allows it, moves Answer to Follow Active.

Spec: Q4; Implementation → Endpoint tab.

Recommended model rationale: a layout change and a small state removal on one tab.

## Acceptance criteria

- [ ] Component tests: the heading follows Answer; Add moves Answer to the copy and the editor follows; Follow Active edits the active preset.
- [ ] The tab's copy passes the copy sweep.
- [ ] The four gates are green.
