# 01: Routine Shape and Migration

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a wide shape change across the engine, editor, presence and import paths. It is mechanical, but a missed caller is easy.

## What to build

An entity with a kind holds Routines instead of a flat Start list, and every world plays exactly as before.

- World shape: an ordered list of Routines replaces `starts` and `traversable`. A Routine has an id, a name, optional Requirement Rows, its own Traversable and its Starts (Q8, Q10, Q13, Q14). The Requires field exists in the shape; nothing reads it yet (02 does).
- `migrateWorld` moves `starts` and `traversable` into one Routine with no gate, named "Routine 1". Idempotent. The library entity file and character-card import pass through it. Persona entities with a Start Locations list are untouched. Runtime characters get one ungated Routine.
- Every reader of Starts and Traversable reads the applying Routine. Until 02, that is always the first Routine.
- The Routine tab edits the first Routine, with no visible change.
- The save shape is unchanged in this ticket.
- Glossary: **Routine**; Schedule drops "routine" from its avoid list; Traversable is per Routine. Docs: the world format page and the wiki's entity Routine page. Changelog fragment.
- ⚠️ Export-shape change for worlds.

Spec rulings: Q8, Q10, Q13, Q14.

## Acceptance criteria

- [x] Migration test: a world with flat Starts migrates to one ungated Routine with the same Starts and Traversable; a second run gives the same result. `entityRoutineMigration.test.ts` "Routines from flat Starts": Unique, Generic, kind with no Starts, Custom Persona, second run, library read, stored Routines over stray flat fields. Shown to bite: a wrong Routine name turns 4 red.
- [x] A world exported after migration and imported again round-trips. Same file, "round-trips a world exported after the migration and imported again".
- [x] Existing position engine, presence, Sample Placement and Routine tab tests pass on the migrated shape with no behavior change. Every test related to the changed files passes (`vitest related`); fixtures moved to `routines`, assertions kept.
- [x] Every bundled world loads and places its cast as before (bundled-world tests). The 7 bundled worlds with a cast are rewritten to `routines` (Q28, option A); a check against Base found only `starts`/`traversable` moved, nothing else changed. `bundledWorlds.test.ts` "stored in the current shape", `entityPlaces.castRecord.test.ts` and `locationPresenceReasons.bundled.test.ts` (recorded casts and Presence lines) pass. `npm run fingerprints` wrote no change.

## Landed

**Not verified**
- Nothing open in the criteria.
- The wiki page `docs/World-Editor-Entities.md` is unchanged: nothing visible changes in 01. It still says "routine" for a daily Schedule; 03 should reword it when the Routine strip lands.

**For you**
- Open an older world (3.7.0) in the editor and check an entity's Routine view looks as before.
- Notes for later tickets: the update-available check compares every Routine (name, Requires, later Routines) while the dialog shows only the first Routine's two rows, so a difference only there would show an update with "same" rows (03 owns per-Routine rows). Write-back returns a Routine's `requires` unmapped (02/03). The engine's `Routine` view type in `positionEngine.ts` still carries the old word (02 owns it).
