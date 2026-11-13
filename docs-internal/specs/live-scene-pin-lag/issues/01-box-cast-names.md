# 01: Box Cast Names

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A Start or Before write that moves a pinned entity name or Stranger Name reaches that turn's requests.

- `useResolvedWorld` exposes the cast pipeline as a callback over a pin set (`entitiesFor`). Its own `entities` memo calls it with the live pins.
- `SceneWrites` gains `entities` (the authored cast under the box's pins) and `strangerLabels` (the labels read from that cast).
- `turnCodeView` fills both from `overPins`. The labels use the same met list, persona, locations and story aliases as the live `strangerLabels` memo.
- `liveChipScene` swaps each entity for the box's copy by id, in `allEntities` and in the authored `entities`, and reads the box's labels over the live ones.
- Changelog fragment in `docs-internal/changelog.d/` (Fixed).

Spec rulings: Q1.

## Acceptance criteria

- [x] A liveScene test resolves a cast with a band-pinned name and Stranger Name under live pins, then a box under moved pins. The roster in the box's scene reads the moved name and label. (`a box write that moves a pinned name` › `rosters the box's name and Stranger Name`, real `resolvePlaceholders` with pins.)
- [x] That test fails on the current `liveChipScene`. (Run before the fix: the roster read `Vix` / `The Fox of the Woods`.)
- [x] With no box, or a box without `entities`, the scene is unchanged (existing liveScene tests green). (44/44 green, plus `keeps the live names with no cast in the box`.)
- [x] Gates green. (`ticket_gates.py` exit 0; prepare reruns the full list.)

## Landed

**Not verified**
- The test hands the pins in directly; the stat-band-to-pin step (`pinsFor`) is not run in it. The GameViewer wiring is pinned by source-scan rows in `personaReaders.test.ts`, not mounted.

**For you**
- Sunmeadow Town, day one disguised: the opening narrator request names Zoroark "A Familiar Face" (live recheck `.scratch/pin-lag-live/92-opening-name.1.exchanges.json`, turn 1).
