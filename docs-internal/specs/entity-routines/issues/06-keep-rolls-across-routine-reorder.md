# 06: Keep Rolls Across a Routine Reorder

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: save-shape reading in the position engine; Begins Following and load edge cases need care.

## What to build

A save keeps an entity's rolled Start when the author later adds or reorders Routines, so no mid-game re-roll happens.

- Today `routineId` is written only for entities with two or more Routines. An absent one reads as the first Routine (Q31).
- A save of a one-Routine entity, loaded after the author adds a Routine and moves it to the top, matches its saved `startId` against the new first Routine, finds nothing, drops the roll and re-rolls. The re-roll counts as fresh, so Begins Following can fire mid-game, against Q31 ("Begins Following acts only for the Routine that applies at new game").
- Fix: find the kept roll by the Start id across every Routine (Start ids are unique per entity), or always write the Routine id. Pick the one that needs no save-shape change if it covers the case.
- A load-time re-roll never starts a follow.
- Found by the spec close review.
- ⚠️ If the fix writes `routineId` for every entity, it is a save-shape change.

Spec rulings: Q4, Q31.

## Acceptance criteria

- [ ] Engine test: a saved one-Routine entity loads into a world where a new Routine sits first and keeps its Start; the guard bites with the old lookup reinstated.
- [ ] Engine test: a load-time re-roll onto a Start with Begins Following does not start a follow.
