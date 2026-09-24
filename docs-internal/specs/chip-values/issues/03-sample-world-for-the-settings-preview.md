# 03: Sample world for the Settings preview

Status: ready-for-human
Base: 62982835
Blocked by: 01 — Chip Values module with the authored adapter
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Workload: a contained swap. One world literal to author from strings that already exist, one preview pool to trim, one coverage test to retire. The risk is a changed preview string, and the existing pool tests catch that.

## Parent

[Spec: Chip Values](../spec.md)

## What to build

A player opens Settings → Prompts → Preview with no game running and sees the same sample values as before, now produced by Chip Values. A small sample world is authored in code from today's sample strings: the coast, its places, Wren and Harrow, the sample stats and traits and lore. The sample adapter runs it through the authored adapter from ticket 01. The preview pool's static scene samples go. Its derived layer (settings guidance chips) and the sample turn (per-turn tokens) stay exactly as they are, and the Anatomy hub keeps reading the same sample turn.

## Acceptance criteria

- [ ] A sample world literal exists beside the module, built from the current sample strings, and is not listed in the library
- [ ] The sample adapter returns a Chip Scene for that world through the authored adapter
- [ ] The preview pool composes samples from the module's output for scene-derived tokens; its hand-written scene sample strings are deleted
- [ ] The derived layer and the sample turn are unchanged; the Anatomy hub's canned material still comes from the same sample turn
- [ ] The preview pool's every-token-has-a-value test is deleted; the module's drift guard covers it
- [ ] The remaining preview pool tests, the Request Anatomy panel tests, and the Settings prompt-options tests pass without edits
- [ ] Settings → Prompts → Preview with no game running shows a value for every chip the editor offers, verified in the app with the dev-router
- [ ] Four gates green; `graphify update .` run; changelog entry under In Progress, 🛠️ Developer tooling, grouped with ticket 01's entry

## Blocked by

- 01 — Chip Values module with the authored adapter
