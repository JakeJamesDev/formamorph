# 05: Authoring Reads the Sample Placement

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Every authoring surface that shows "who is here at the start of the story" asks the Entity Places module for the Sample Placement, so they all show one stable cast.

Readers that move: the script hover card for a location, the authored chip scene, the Test Bench AI context, the Openings tab view, and the opening pool when authoring calls it.

Corrections that land here (Q9, Q10):

- **The script hover card (#3).** Its "Present" row lists a Unique entity at every routine place and leaves out an entity that begins at Player's Starting Location. It lists who the Sample Placement puts at that location, which is what a Test Code run of `present` gives.
- **The Openings tab (#6).** It counts a Unique entity as at the start through any row place, and gives an entity that begins at Player's Starting Location the "at no start" badge and no chance. An entity counts as at a start only when that start is one of its Start places.
- **A script run with no live positions (Q10).** The game view's standalone script run and the tool script run can fall back to an opening state with no positions, where a Unique entity stands at every listed place. They use the Sample Placement.

Settle the spec's three open checks before moving the reader each concerns, and write the answer into the landing:

1. Which cast the Test Bench opening pool passes to the opening pool reader.
2. How often a script run uses the opening state with no positions, and from where.
3. When the opening placement cannot place an entity with a kind. Decide nothing here: if that case exists, send the spec session the case and ask what its Sample Placement is.

Add each moved reader to the agreement test. The script guide and the Test Bench wiki page change where they describe the hover card or the placement.

Spec rulings: Q6, Q9 (#3, #6), Q10. ADR-0005.

## Acceptance criteria

- [x] The script hover card's "Present" row for a location equals the Sample Placement's cast there. A test compares the card with a Test Code run of `present` on one fixture and fails with the old read. — `entityPlaces.authoring.test.ts` "lists at $id what a Test Code run of `present` gives"; red with the old read restored.
- [x] An entity that begins at Player's Starting Location appears on the hover card of the sample start. — same file, "lists an entity that begins at Player's Starting Location on the sample start".
- [x] On the Openings tab, a Unique entity whose only tie to a start is a Schedule row does not count as at that start. The test fails with the old read. — `openings.test.ts` "leaves out a Unique entity whose only tie to the start is a Schedule row"; red with the stored list restored.
- [x] On the Openings tab, an entity that begins at Player's Starting Location shows as at the start, with its chance, and has no "at no start" badge. — `openings.test.ts` "counts an entity that begins at Player's Starting Location at the start, with its chance".
- [x] A script run with no live positions places each Unique entity at one place. The test fails with the old fallback. — `entityPlaces.authoring.test.ts` "places each Unique entity at one place"; red with the old `openingStateOf` fallback.
- [x] The authored chip scene and the Test Bench AI context still show the same cast as before on the bundled worlds. A test compares them. — `entityPlaces.authoring.test.ts` "the bundled world %s keeps its authoring cast", against `openingCast` on all 8 bundled worlds.
- [x] The agreement test holds every reader moved here. — hover card, authored chip scene, Test Bench AI context, Openings tab, Test Bench opening pool, script run with no live positions.
- [x] The landing answers the three open checks with evidence. — see Landed.
- [x] The script guide and the Test Bench page match the new behavior. — `docs/ScriptsGuide.md` Test Code list, `docs/Test-Bench.md` AI Context and Opening notes.
- [ ] A changelog fragment records the three fixes.

## Landed

**Open checks**

1. **Test Bench opening pool cast.** It passed `newGamePool` the authored cast as stored, so the pool read each entity's derived routine list: a Unique entity counted at the start through any row place, and a Player's Starting Location entity never counted. Play's draw reads the rolled opening book. It now passes the Sample Placement at the bench's start (`testBench/opening.ts`, test "draws from the cast the Sample Placement puts at the chosen start").
2. **Script runs with no live positions.** GameViewer's tool-script source falls back to the opening state only when `prepareStatCode` throws, and it lays the live book's places on, so "no positions" means a live book that places nobody. The tool runner's `openingStateOf({})` fallback has no cast at all. Both now take the Sample Placement through `standaloneStateOf` / `authoringStateOf`.
3. **Entities the opening cannot place.** Two cases: an entity with a kind and no Starts (`openingCast` also gave it nowhere), and an entity whose every Start is at Player's Starting Location when the sample has no player start (`openingCast` kept its stored row places). Spec ruling Q26: nowhere in both; `samplePlacement` unchanged. Test "places the stray nowhere where `openingCast` kept it at its row place".

**Fixes, for the unreleased entry (Q25: no fragment, kinds are unreleased)**

- A location's card in a code box lists a Unique entity at its one sample place, and an entity that begins at Player's Starting Location on the sample start.
- The Openings tab counts an entity at a start only through its Start places; a Player's Starting Location entity counts, with its chance.
- A script run with no live positions places each Unique entity at one place.
- The Test Bench Opening Pool draws from the cast placed at the chosen start.

**Not verified**

- The changelog-fragment criterion: replaced by spec ruling Q25 (no fragment for a kinds-only fix).
- `standaloneStateOf` reads "no live positions" as empty position maps. A live game whose every kinded entity stands nowhere would get the Sample Placement; it only fires when `prepareStatCode` throws.
- `PoolSources.placesOf` is optional here; ticket 03 makes it required. The Openings tab keeps Start places and the Test Bench keeps the Sample Placement through that change.

**For you**

- Hover a location name in a code box (World Editor → any script): the Present row lists the cast a new game opens with, one place per Unique entity.
- Openings tab in a world with a Player's Starting Location entity that has openings: no "at no start" badge, and a chance shows.
