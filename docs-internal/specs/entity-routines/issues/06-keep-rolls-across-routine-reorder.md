# 06: Keep Rolls Across a Routine Reorder

Status: done
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

- [x] Engine test: a saved one-Routine entity loads into a world where a new Routine sits first and keeps its Start; the guard bites with the old lookup reinstated. `positionEngine.test.ts` "keeps a one-Routine save's roll after the author puts a new Routine first (Q34)"; red with the old `routineIdOf`.
- [x] Engine test: a load-time re-roll onto a Start with Begins Following does not start a follow. "never begins following on a load-time re-roll (Q34)"; red with the `fresh` gate put back, and its swap case also red with the old lookup.

## Landed

**Not verified:** nothing.

**For you:**
- Nothing a player needs to judge; the fix is engine-only, with no UI.
- Adjacent, not fixed (review): a saved `routineId` that names a deleted Routine skips the Start lookup and re-rolls. A lost-Start re-roll also drops a saved follow, script follows included. Both behaved this way before this ticket.
