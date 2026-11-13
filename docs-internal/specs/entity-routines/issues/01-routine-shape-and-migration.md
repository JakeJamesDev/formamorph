# 01: Routine Shape and Migration

Status: ready-for-agent
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

- [ ] Migration test: a world with flat Starts migrates to one ungated Routine with the same Starts and Traversable; a second run gives the same result.
- [ ] A world exported after migration and imported again round-trips.
- [ ] Existing position engine, presence, Sample Placement and Routine tab tests pass on the migrated shape with no behavior change.
- [ ] Every bundled world loads and places its cast as before (bundled-world tests).
