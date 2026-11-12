# 12: Write-Back Keeps the Library Item's Places

Status: done
Blocked by: 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Ticket 11 reported two problems in linked content and did not fix them. Neither is confirmed. Confirm each with a failing test first. If one does not reproduce, say so in the landing and build nothing for it.

**1. Write-back stores this world's location ids in the library item.** When the author owns a linked copy, saving the world writes the copy back to its library item (`planWriteBack` in `src/lib/linkedContent.ts`, `src/lib/libraryWriteBack.ts`). The routine goes in with this world's place ids. A copy of the same item in another world has no connection for those ids, so its next library update drops those places (Q30).

The library item must stay usable from every world:

- A place the copy reached through a connection goes back as the library item's own place, the one the connection maps from. A second world that connected the same place keeps it on update.
- A place the author added in this world, with no connection, goes back as a new named place of the library item, as Save to Library writes one (`locationRefs`, Q21). A second world then sees it as a place to connect, not as a lost place.
- The copy's connections in this world gain the new place, so the copy does not read as differing right after the write-back.

Use the carry of ticket 11 (`carriedRoutine`) and its inverse. Do not add a second mapping.

**2. A linked copy with no kind may always read as "differs".** The compare counts the source's `locationRefs`, and a world copy has none. A copy with no kind that equals its library item must not differ. Its stored list stays world-owned (Q2), so the compare ignores place data on both sides for an entity with no kind.

Kinds are unreleased, so problem 1 is a fix to unreleased work (Q25): no fragment, list the line in the landing. Problem 2 can affect a v3.6.2 author; if the test shows it on a v3.6.2 shape, it gets a changelog fragment.

Spec rulings: Q30, Q31, Q33, Q21, Q25, Q2.

## Acceptance criteria

- [x] A test reproduces problem 1: two worlds link one Unique entity, each with its own connections. World B's copy writes back. World A's copy updates and loses a place. The test fails before the fix. (`leaves world A's copy every place it has a connection for` in `linkedContent.writeBack.test.ts`, red at Base)
- [x] After the fix, world A's copy keeps every place it has a connection for. (same test; Q34 kept entries in `keeps the Cellar Start, the Cellar row in its old place, and the Cellar in Can Also Go`)
- [x] A row the author added in world B at a place with no connection reaches the library item as a new named place. World A's update shows it as unconnected and drops only that row. (`names a place added in world B as a new library place…`, read through `unresolvedReferences`)
- [x] Right after a write-back, world B's copy does not read as differing from the library item. (`connects the new place and reads as its library item`: compare true, second `planWriteBack` empty)
- [x] A write-back followed by an update in the same world gives the same routine back, Start and row ids aside. (`gets the same routine back from an update…`)
- [x] Carry, update, compare, repair and write-back share one mapping and its inverse. No second mapping exists. (`returnedPlaces` builds its map with `carryMap`; `withRoutineReturned` and `placesReturned` only invert it)
- [x] A test reproduces problem 2, or the landing says it does not reproduce and shows the test that proves it. (`a linked copy with no kind` block, red at Base on the v3.6.2 shape)
- [x] After the fix, a linked copy with no kind that equals its library item does not differ, and one with a changed description does. (`matches its library item…`, `differs once its description changes`)
- [x] The landing lists the fix lines for the entity kinds entry, and says whether problem 2 got a fragment. (below)

## Landed

Spec-session rulings Q34–Q39 (2026-11-11) shaped the build: Q34 keep what the copy could not hold, Q35 map back by entry, Q36 refs and connections, Q37 minted fallback Starts stay out, Q38 Anywhere against no list, Q39 membership through the same inverse. They still need folding into the spec.

Fix lines for the entity kinds entry (Q25, no fragment):
- Saving a world writes a linked entity's routine back in the library item's own places, so other worlds that link it keep their places on update.
- A place added in one world reaches the library item as a new place to connect elsewhere, and the library keeps the Starts, rows and Can Also Go places that world never had.

Problem 2 reproduced on the v3.6.2 shape and got a fragment (`docs-internal/changelog.d/entity-places-12.md`, World Editor fix).

Mutation checks: each guard (kept Starts, kept rows, entry-first mapping, added connections, the no-kind compare, the minted fallback, Q38, Q39) was reverted once and turned its own test red.

**Not verified**
- Nothing in a running app. The write-back runs only on a world save against IndexedDB, and the tests drive `planWriteBack` with the real `toLibraryItem`.

**For you**
- Link one character into two worlds, change its routine in one world and save, then update the copy in the other world and check that no place is lost.

For you: link one character into two worlds, change its routine in one world and save, then update the copy in the other world and check that no place is lost.
