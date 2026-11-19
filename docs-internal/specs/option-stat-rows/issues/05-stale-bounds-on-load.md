# 05: Stale Bounds On Load

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Spec Q16 says loading a save re-derives bounds and toggles under the world's current rows and Option values. The re-derive skips worlds with no valued Option, and only re-derives the entities a current row names. So a save keeps stale bounds when its world drops every Option, or drops every row naming an entity. Ticket 01 limited the re-derive because an unconditional one also corrects existing fixtures whose bounds disagree with the traits in force; find out what those fixtures are before widening it.

## Acceptance criteria

- [x] A save made with Easy's "+100 max Gold", loaded after the author deletes the Option, reads the base max. (`traitRuntime.optionRows.test.ts`: "gives a save made on Easy the base max once the author deletes the Option")
- [x] A save whose world drops the last row naming the Dragon reads the Dragon's base bounds. (`traitRuntime.entityOptionRows.test.ts`: "gives an entity its base bounds once the world drops the last row naming it")
- [x] Each guard goes red with its bug reinstated. (The Option gate brought back failed the Easy, Frail and deltas tests; the named-entities loop failed the Dragon test; dropping the backfill bases or the bases recovery each failed its own ratchet test.)

## Landed

Fixtures found: only two code-bound migration tests in `useSettleOnSaveLoad.test.tsx` stored max 100 under Paladin's +10. They now store 110 (Q30).

**Not verified**
- Entity traits are read from the world, not frozen: `ownedTraits` holds ids only. An author edit to an entity trait's bound row now moves that entity's bounds on load. Freezing them would change the save shape.
- History snapshots keep their stored bounds; only the live state re-derives.

**For you**
- Load a save from before an author edit to a trait's max row, and judge whether the corrected max reads right in the Stats tab.
