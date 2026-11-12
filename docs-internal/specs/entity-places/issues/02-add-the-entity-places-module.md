# 02: Add the Entity Places Module

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

One module that answers where an entity is. It is added beside the stored `locations` field; no reader moves in this ticket and no behavior changes.

The module answers four questions for every entity (Q2, Q6):

- **Position**: where it stands now, from the position book. A Unique entity has one. A Generic entity has one per Generic Entity Instance, and two in one place count once. An entity with a kind and no Position stands nowhere (Q10). Runtime characters are answered too.
- **Sample Placement**: where authoring places it at the start of the story, for a given player start.
- **Presence**: each place it can be, with one or more reasons: it begins there, a Schedule row names it, Can Also Go lists it. Player's Starting Location expands to the world's starting locations, or to every location when none is flagged. Can Also Go set to Anywhere is a flag on the answer, not every location. A row place with no path from its Start is left out (Q7, Q8).
- **Start places**: where it can begin, with Player's Starting Location expanded.

It also answers the inverse of each: which entities are at one place or at any of several places, in the cast's own order (ADR-0003's inverted index, kept by ADR-0017).

For an entity with no kind, all four answers come from its stored membership list. The module is the only code that needs to read that list. It also owns the write of that list for a no-kind entity.

This ticket owns every shared type and helper of the module. Tickets 03 to 09 import them and add none of their own for these questions. If a later ticket needs an answer the module lacks, it asks the spec session.

Build the agreement test here: one fixture world, and a table of readers that must match the module. Seed it with the readers that already agree today (the turn's "who is here" computation, the live chip scene, the authored chip scene). Tickets 03 to 09 each add their readers to it.

Do not design the interface from this ticket's wording. Read the readers listed in the spec's Q9 and in the tickets that follow, and give them the smallest interface that serves all of them.

Spec rulings: Q2, Q6, Q7, Q8, Q10, Q12. ADR-0017.

## Acceptance criteria

- [x] The module answers Position, Sample Placement, Presence and Start places for a Unique entity, a Generic entity and an entity with no kind. Module tests cover each. (`src/lib/entityPlaces.test.ts`, one describe per question.)
- [x] Presence carries a reason per place. Tests cover: begins there, a row names it, Can Also Go lists it, and a place with two reasons. ("names each place a Unique entity can be, with every reason, in order"; Can Also Go is the `traversable` reason, Q22.)
- [x] Player's Starting Location expands to the flagged starting locations, and to every location when none is flagged. Tests cover both, for Presence and for Start places. (Two Presence tests, one Start places test.)
- [x] Can Also Go set to Anywhere is reported as a flag and adds no place. ("reports Traversable set to Anywhere as a flag that adds no place".)
- [x] A row place with no path from its Start is absent from Presence. The test fails when the path check is removed. (Mutation run: removing the check turns "leaves out a row place with no path from its Start" red.)
- [x] An entity with a kind and no Position stands nowhere. Two Generic Entity Instances in one place give that place once. (Both mutated back and seen red.)
- [x] A runtime character has a Position. ("gives a runtime character a Position, where it stands once the engine places it".)
- [x] The "who is at this place" queries return ids in cast order for one place and for a set of places. (`idsAt` and `idsAtAny`, tested for Position and Presence.)
- [x] The agreement test exists, runs on one fixture world, and holds at least the three seeded readers to the module. (`src/lib/entityPlaces.agreement.test.ts`: the turn's "who is here" via `presentEntityIds`, the live chip scene, the authored chip scene, at every location. Breaking `presentEntityIds` turned three rows red.)
- [x] No reader outside the module changes in this ticket, and no user-facing behavior changes. The landing states how that was checked.

## Landed

**The interface** (`src/lib/entityPlaces.ts`). Each answer is a `PlacesOf` function, `(entity) => places`, so one pair of inverse queries serves all four:

- `positionOf(entity, standings)` / `positionsIn(standings)`: Position.
- `samplePlacement(cast, world, playerStart)`: Sample Placement.
- `presenceOf(entity, world)` gives places with reasons (`begins` with its Start ids, `row` with Start and row ids, `traversable`, `member`) and an `anywhere` flag. `presenceIn(world)` gives places only.
- `startPlacesOf(entity, world)`: Start places.
- `namedPlacesOf(entity)`: every place id the routine names, with no world and no path check. It is for the orphan rule (ticket 07) and the carry and library list (ticket 09).
- `idsAt` / `idsAtAny`: who is at a place or at any of several places, in cast order.
- `withMembership`: the no-kind membership write. `withEntityLocations` in `entityPresence.ts` now calls it, with the same behavior.

**Rulings this ticket asked for:** Q18 (rows of a Player's Starting Location Start get no path check), Q19 (Presence keeps only the world's places; the named-places read), Q20 (`member` reason), Q21 (no unchecked mode), Q22 (reason `traversable`).

**How no behavior changed was checked.** The diff outside the new files is one line: `withEntityLocations` delegates to `withMembership`, whose body is the old one moved. No other reader or writer changed. The review gates passed (typecheck, changed-file lint, affected tests), and prepare runs the full gate list.

**Mutation run.** Thirteen mutations of the module, each reverted: removing the path check, the no-Position fallback, the Generic dedupe, the Player's Starting Location expansion, Anywhere expanded, unknown places kept (twice), Player's Starting Location rows path-checked, named places without Traversable, the begins reason, cast order, row places in Start places, and no-kind read as kinded. Each turned at least one test red. Coverage of `entityPlaces.ts`: 97% statements, 89% branches, 100% lines.

**Not verified:** none.

**For you:** nothing to judge in the app; this ticket changes no screen.

**Notes for later tickets**

- Sample Placement puts an entity the opening cannot place nowhere. Ticket 05's open check 3 settles that case; the spec session agreed to the default until then.
- The agreement fixture's book places every entity with a kind. The seeded play readers still fall back to the stored list when an entity has no Position, so a no-Position row would disagree until ticket 03 corrects them.
- `entityPresence.ts` → `entityPlaces.ts` → `positionPlay.ts` → `entityPresence.ts` is an import cycle. Every import in it is used only inside function bodies. The cycle goes away when ticket 10 moves the writers to `withMembership` and drops the wrapper.
