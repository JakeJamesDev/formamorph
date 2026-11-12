# 03: Play Reads Position

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

In a running game, every part that asks "who is here" or "where is this entity" asks the Entity Places module for Position. Today these readers get a copy of the cast whose `locations` field was overwritten with where each entity stands. That copy stops being how they read.

Readers that move: the turn's "who is here" computation, the met roster by location, the narration's visitor additions, the reachable runtime visitors, the sub-location and reachable entity lists that feed the Entities chip, the live chip scene, the game view's present ids, scene entity override and inventory owners, the new-game opening draw, and the play fields of the script snapshot.

Corrections that land here (Q9, Q10):

- **No Position means nowhere.** An entity with a kind and no Position today falls back to the stored list and stands at every routine place at once. It stands nowhere.
- **The page-one opening redraw (#9).** It reads live Positions against the opening's start location, so its pool changes after entities move. It uses the placement the game opened with.

The script snapshot's fallback for an entity with no position goes with the first correction. A script run that has no live positions at all belongs to ticket 05.

Add each moved reader to the agreement test.

The changelog fragment names the two corrections as fixes.

Spec rulings: Q6, Q9 (#9), Q10.

## Acceptance criteria

- [x] Each reader listed above gets its cast from the module's Position answer. The landing lists each reader and its test. (Reader table below.)
- [x] In a running game, an entity with a kind and no Position is in no location's cast, in the narration context, the Entities tab data, the live chips and the script snapshot. The test fails when the old fallback is restored. (Agreement test, book "the baker and the gulls with no Position"; restoring the old read in the script snapshot, met roster, live scene and opening pool each turned it red.)
- [x] After an entity leaves the player's start, a redraw of page one draws from the same pool as the first draw. The test fails with the old read. (`GameplayContext.entityPlaces.test.tsx` "keeps the rolled cast across a save…"; `personaReaders.test.ts` pins the game view's redraw to `openingPlacesOf(openingPlacement, …)`.)
- [x] A Unique entity with a Position is at that place only, and a Generic entity is at each place a Generic Entity Instance stands, once. (Agreement test: the baker, and the gulls with two instances at the docks.)
- [x] A runtime character met this turn counts where it stands. (Agreement test: the sailor at the docks, in every Position row.)
- [x] An existing save loads with every entity where it was. A test loads a stored save fixture and compares who is at each location before and after. (`GameplayContext.entityPlaces.test.tsx` over `src/lib/__fixtures__/rampage-positions-save.json`.)
- [x] The agreement test holds every reader moved here. (The game view's own three readers join through the live chip scene rows and the source scan; no mount test, per the spec.)
- [x] A changelog fragment records the two fixes. Superseded by Q25: no fragment; the fixes are listed below for the spec close.

## Landed

**Export shape: save.** `GameState.openingPlacement?: { positions: Record<entityId, locationId>; genericPlaces: Record<entityId, locationId[]> }` (type `OpeningPlacement`), set once at New Game (Q24). A save without it loads; its redraw reads the Sample Placement at the page-one start.

**Readers and their tests** (all in `src/lib/entityPlaces.agreement.test.ts` unless named):

| Reader | Test |
|---|---|
| Turn's "who is here" (`presentEntityIds`) | row "the turn's who is here" |
| Met roster by location (`computePresence` → `metRosterByLocation`) | row "the met roster by location" |
| Narration visitor additions (`selectVisitorAdditions`) | describe "the narration visitor additions" |
| Reachable runtime visitors (`selectReachableVisitors`) | row "the reachable runtime visitors" |
| Sub-location and reachable lists of the Entities chip | scope rows, via the scene's new `placesOf` |
| Live chip scene, with and without a turn box | two rows |
| Game view present ids, scene entity override, inventory owners | read the live scene's `placesOf` / `positionsIn`; covered by the live scene rows |
| New-game opening draw (`newGamePool`, `placesOf: positionsIn(startBook)`) | row "the new-game opening draw" |
| Page-one redraw (`openingPlacesOf`) | row "the page-one redraw" + `GameplayContext.entityPlaces.test.tsx` |
| Script snapshot play fields (`locationIds`) | describe "the script snapshot" |

**Fixes for the spec close (Q25, kinds-only, no fragment):**
- An entity with a kind and no Position stands nowhere in play, not at every routine place.
- The page-one redraw draws from where the cast stood when the game opened.

**Shared shapes agreed with ticket 05:** `ChipScene.placesOf` and `PoolSources.placesOf` are required. The authored scene, Test Bench AI context, Test Bench opening pool and Openings editor pass `samplePlacement` as placeholders that ticket 05 corrects. A script run with no live positions still reads the stored list in `sandboxSnapshot.ts`; that case is ticket 05's.

**Test fixtures that read the old fallback.** The game-panel harness (`src/test/gamePanels.tsx`) loaded a world without placing its cast, so panels saw kinded entities through their stored lists. It now places the cast as a new game opens, and its turn snapshots carry those positions. The Movement tag test's Unique entities get positions at their Start. Opening-pool tests over migrated worlds read the Sample Placement.

**Not verified:** none.

**For you:** nothing to judge on screen; play reads the same cast except for entities with no Position.
