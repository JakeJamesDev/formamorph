# 09: Carry a Unique Entity With Its Routine

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

When an author adds a Unique entity from the library to a world, the entity keeps its routine, mapped to that world's locations. Today the carry maps only the stored list. The entity's Starts keep the place ids of the world it came from, and the next load rebuilds the list from those unmapped Starts.

The rule is the one a Generic entity already follows (Q11):

- A Start whose place maps to a location of the new world is kept, with its Schedule rows remapped. A row place that does not map is dropped, and a row left with no place is dropped.
- A Start at Player's Starting Location is kept as it is.
- When no Start is kept, the entity takes one Start, with no rows, at the mapped place.
- Can Also Go is mapped the same way. Anywhere stays Anywhere.

The link-repair path for a linked library entity follows the same rule. The stripping of place data from linked content must treat Starts as it treats the stored list, so a link does not carry another world's place ids.

The library's "locations this entity carries" list comes from Presence, so it includes Can Also Go.

An entity with no kind keeps today's carry: it belongs to the mapped places.

Add the carried result to the agreement test: after a carry, the module's Presence for the entity names only locations of the new world.

Spec rulings: Q11, Q7.

## Acceptance criteria

- [x] A Unique entity with two Starts, one whose place maps and one whose place does not, arrives with the mapped Start and its rows remapped, and without the other. The test fails with the old carry. (`entityKind.test.ts` "keeps the Start whose place maps…"; old-carry failure shown by `placedIn` in `entityPresence.test.ts`, restored once: `expected [] to deeply equal ['tavern','pier']`.)
- [x] A Schedule row with one mapped place and one unmapped place keeps the mapped place. A row with none is gone. (same test: the Wander row keeps `pen`, the `lost` row goes.)
- [x] A Unique entity with no Start that maps arrives with one Start, no rows, at the place it was added to. (first mapped place in ref order, per spec-session answer; "takes one Start with no rows at the first mapped place"; mutation to all places went red.)
- [x] A Start at Player's Starting Location survives the carry unchanged. ("keeps a Start at the player's starting location as it is".)
- [x] Can Also Go as a list is mapped and loses unmapped places. Anywhere stays Anywhere. ("maps a Can Also Go list…".)
- [x] After the carry, and after a save and reload of the world, the entity's Presence names only locations of that world. The test fails with the old carry. (`entityPresence.test.ts` reload through `migrateWorld`; agreement test "a carry into another world agrees with Entity Places".)
- [x] Link repair of a linked Unique entity gives the same result as a fresh carry. A test compares them. (`withCarriedRoutine` vs `placedIn` through `carryMap`, both kinds per Q31; red when the copy's routine was kept.)
- [x] A Generic entity and an entity with no kind carry as before. Existing tests still pass unchanged. (Generic carry tests only renamed to `withRoutineMapped`; gates green.)
- [x] The library's carried-locations list includes a Can Also Go place. (`librarySources.carriedPlaces.test.ts`, red with the old `entity.locations` read.)
- [ ] A changelog fragment records the fix.

Spec rulings added after this ticket was written: Q19, Q21 (the library list of carried places reads the module's named places; Presence has no unchecked mode).

## Landed

**Not verified**

- A changelog fragment records the fix. Replaced by Q25: kinds are unreleased, so no fragment. Fixes for the entity kinds entry at close:
  - A Unique entity added from the library keeps its routine, mapped to the new world's locations.
  - A library entity carries its Can Also Go places, so the add step asks where each one goes.
  - A linked entity with a kind keeps its own routine when its library source updates, and no longer shows as changed against it.
  - Repairing a linked entity with a kind rebuilds its routine from the library source.

**For you**

- Repairing the links of a linked Generic entity now replaces its Starts with the library source's, carried afresh (Q31). Starts you added to that copy in this world are lost. Try it: World Editor, a linked Generic entity whose location went away, Connect References.
- A library update no longer changes a linked copy's Starts, rows or Can Also Go (Q30, option A). Ticket 11 replaces this with a mapped read: replace `COPY_ROUTINE_FIELDS` and `withoutCopyFields` in `src/lib/linkedContent.ts`, and the routine block in `applyLibraryUpdate`.
- Export shape: unchanged by this ticket. Save to Library writes `locationRefs` for every named place, Can Also Go included.
