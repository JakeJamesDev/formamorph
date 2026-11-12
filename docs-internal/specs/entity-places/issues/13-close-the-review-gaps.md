# 13: Close the Review Gaps

Status: ready-for-human
Blocked by: 12
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The close review of 2026-11-11 read all twelve landings against the spec and found six gaps. This ticket closes them. Each part is small except the first.

**1. The last copies that write Position into `locations` go (Q6, ADR-0017).** Q6 says the copies that overwrite `locations` in play and for the opening cast "go away as an interface". Three survive:

- `entitiesInPlay` in `src/lib/entityPlaces.ts`, used by `src/lib/useResolvedWorld.ts` and `src/lib/positionPlay.ts`.
- `openingCast` in `src/lib/positionPlay.ts`, which feeds `src/lib/chipValues/authoredScene.ts` and `src/lib/testBench/aiContext.ts`.
- `playerEntity` in `src/lib/formaquestion/playerViewWorld.ts`, which writes Position as `locations` on the player-view copy, and the runtime character path that stores Position as membership.

Each reader of such a copy asks the module for Position or the Sample Placement instead. No copy of an entity holds where it stands in `locations`. The lint rule passes today only because these writes sit inside the module or go through `withMembership`; after this ticket no code writes a Position into a membership.

A runtime character has no kind. Decide with the spec session where its place lives if it is not the Position book; ask before you build that part.

**2. The raw rosters go (Q10).** `entityIdsAt` and `entityIdsAtAny` read the stored list with no kind check. Only tests and `buildEntityContext`, which has no caller, use them. Remove all three, or make the rosters ask Position. Do not keep a function with no caller.

**3. The agreement test holds every moved reader.** Add the authoring tour readers (`tourEntityPresence` in `src/lib/authoringTour/steps.ts`) and the game view's three readers, which only source regexes in `src/lib/personaReaders.test.ts` hold today. Replace a regex with a real call where the reader can be called.

**4. The unreachable-row finding reads the module (ticket 07).** `entity-row-unreachable` in `src/lib/testBench/rules.ts` walks Starts and rows with `startReach` and tests Player's Starting Location itself. The module gives the answer instead: one read that returns the row places Presence left out for lack of a path, built on the same code as `presenceOf`, so Q8 and Q18 have one home. The finding's text says "Schedule rows"; the screen says Routine. Rewrite the summary and the detail from the Writing Guide.

**5. Ticket 07's guards bite.** For each test that ticket 07 added or relied on, restore the old read once and see the test fail. Fix a test that stays green. List each proof in the landing.

**6. A Start the author added goes back (Q40).** Q37 was too wide. `keepsStart` in `src/lib/entityKind.ts` skips a plain new Start on write-back whenever any library Start failed to carry. It must skip only a fallback Start: one at the fallback place, with no rows and weight 1, when no library Start carried at all. Confirm with a failing test first: a Generic copy where one library Start carried and one did not, and the author adds a plain Start at a mapped place. If it does not reproduce, say so and build nothing.

Also in scope, because the review named them and they are one-line changes: bare "instances" in new comments and names becomes "Generic Entity Instances" (the glossary forbids the bare word), and `personaLocations` and `withEntityLocations` take names that say what they return.

Kinds are unreleased (Q25): no changelog fragment; list the fix lines in the landing.

Spec rulings: Q6, Q8, Q10, Q18, Q37, Q40. ADR-0017.

## Acceptance criteria

- [x] No code writes a Position into an entity's `locations`. `entitiesInPlay` and `openingCast` are gone or return no entity copies, and the landing lists each reader that moved. (Both gone; every remaining `withMembership` call is an authoring write; readers listed below.)
- [x] Play, the authored chip scene, the Test Bench AI context and Morphie's player view give the same cast as before for the bundled worlds. A test compares against a record taken at the base. (`entityPlaces.castRecord.test.ts` against `__fixtures__/entity-places-cast-record.json`, recorded before any code change: 8 worlds, 89 locations.)
- [x] A kinded entity with a stale stored list and no Position stands nowhere through every roster. The test fails with the raw rosters restored. (`entityPresence.test.ts` "stand an entity with a kind, a stale stored list and no Position nowhere"; red with the membership read restored in `positionAmong`.)
- [x] `entityIdsAt`, `entityIdsAtAny` and `buildEntityContext` are gone, or each has a caller and asks Position. (All three gone; tests use `idsAt` with a `PlacesOf`.)
- [x] The agreement test holds the authoring tour readers and the game view's readers by a real call. (`tourEntityPresence`; present ids through `presentEntityIds`; the scene roster and Inventory owners extracted to `sceneRosterValues` and `inventoryOwnersIn`.)
- [x] The unreachable-row finding gets its places from the module. `rules.ts` holds no `startReach` call and no Player's Starting Location test for it. (`unreachedRowPlaces` in `entityPlaces.ts`, on the same row walk as `presenceOf`; grep finds neither in `rules.ts`.)
- [x] The finding's text uses the words on the Routine tab. ("Routine row": the tab's list is labeled Routine and its hint says "row".)
- [x] The landing lists a restore-and-fail proof for each ticket 07 test, and names any test that had to change. (Below.)
- [x] The Q40 case has a test that fails before the fix, or the landing shows it does not reproduce. (`linkedContent.writeBack.test.ts` Q40 case: red before the fix, the added Start dropped.)
- [x] A fallback Start still stays out of the library item (Q37's two tests pass unchanged). (All three Q37 tests pass unchanged.)
- [x] No new comment or name uses bare "instance" for a Generic Entity Instance. (Comments and locals in `entityPlaces`, `positionEngine`, `positionPlay`, `presence`, `statCodeTurn`, `entityPresence`, `liveScene`.)
- [x] The lint rule and the whole agreement test pass. (Gates; agreement test 306 green.)

For you: play a bundled world for a few turns, move between places, and check that the people you meet are where the Presence tabs say they can be.

## Landed

**Rulings used:** Q41 (a runtime character's place is Position: the book's, else its saved anchor through `runtimePositions`) and Q42 (Morphie's player-view copy holds no places; its in-game Test Code reads the met live places, with no Sample Placement fallback).

**Readers that moved off a Position copy**
- Play cast (`useResolvedWorld`): `entities` is the plain cast; `authoredCast` folded into it (`usePresence`, `GameViewer`).
- Authored chip scene and Test Bench AI context: the plain cast, places from `samplePlacement`.
- Morphie's player view: copies hold no places; `playerViewWorld` adds `livePlaces`, and `runTestCode` reads them through the new `liveStateOf`.
- Runtime characters: `discoveredAsEntities` writes no membership; `usePresence` and Morphie's `knownIds` merge `runtimePositions`, as the game view already did.
- Renames: `withEntityLocations` → `withMembership` (the module's own); `personaLocations` → `namedStartPlaces`.

**Fix lines (Q25, no fragment; kinds are unreleased)**
- A plain Start the author adds to a Generic copy now goes back on a write-back when at least one library Start carried (Q40).
- The unreachable-row Test Bench finding says "Routine row", the Routine tab's word.

**Restore-and-fail proofs (ticket 07 and this ticket)**
| Old read restored | Red tests |
|---|---|
| no-entities: stored list plus the Player's Starting Location special case | agreement "location has no entities" |
| no-entities: the Custom Persona occupies its places | rules "does not count the Custom Persona entity" |
| nowhere: stored list | agreement "placed in no location", agreement orphan case |
| nowhere: flags an entity naming a missing place | agreement orphan case, rules "leaves an entity whose only placement is dead" |
| orphan check: stored list / routine split | none: the old and the module read give the same answer, so no test can tell them apart |
| orphan fix: writes the list back | rules: the three orphan fix cases and "writes no list for an entity with a kind" |
| row-unreachable: no path check | agreement row case, rules "leaves a connected row place…" |
| row-unreachable: a Player's Starting Location Start checks a path | rules "leaves a connected row place…", four Presence tests |
| row-unreachable: counts rows of a Start the world lacks | rules "leaves a connected row place…" (new case) |
| Q10: a kinded entity with no Position at its stored list | 7 tests, the new stale-list roster test among them |
| Q40: skips a plain Start whenever any library Start failed to carry | the Q40 test |
| Q42: falls back to the Sample Placement with live places | the routined-world Test Code case (added: the player-view copies carry no routine, so the first cases could not tell) |

**Tests that changed:** the tests of the removed functions now call `idsAt` with a `PlacesOf` (`entityPresence`, `persona`, `runtimeCharacters`, `locationContext`, `aiContext`, `version`, `positionPlay`, `authoringPlacement`, `entityFollowing`, `GameplayContext.entityPlaces`, `entityPlaces.authoring`); `playerViewWorld.test` asserts `livePlaces`; the agreement test reads the player view through `positionAmong`; the unreachable-row test checks the new words. The record test writes a placeholder-rolled roster name as `<rolled>`, because each run rolls afresh.

**Q41 save proof:** `GameplayContext.entityPlaces.test.tsx` "a runtime character through a save and a load" saves and loads through the real storage; the stored record is unchanged and the character stands at its anchor.

**Review notes**
- The play arm of the cast record ran `entitiesInPlay` when it was recorded; the record predates every code change.
- Morphie's `livePlaces` merges no `runtimePositions`: the Test Code world holds the authored cast only, so it holds no runtime character.
- Left as named follow-ups: the `{ ...runtimePositions(x), ...positions }` merge now sits in five production sites (two in `GameplayContext` predate this ticket) and could be one module helper; Test Bench summaries read "1 entities" for a count of one, in every rule.

**Not verified**
- `testing/baseline/harness/entity-location-probe.cli.ts` was already broken against current signatures (`entityMoveRequests`); I only removed its `entitiesInPlay` call.
- `usePresence`'s `runtimePositions` merge is a hook line with no mount test (spec: no new mount tests).

**For you**
- For you: play a bundled world for a few turns, move between places, and check that the people you meet are where the Presence tabs say they can be.
