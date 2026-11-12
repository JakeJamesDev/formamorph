# 06: The Presence Tab and Canvas Read Presence

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

In the World Editor, the Presence tab of a location and the Locations Canvas ask the Entity Places module for Presence. They then show the same places for the same entity.

Readers that move: the Presence tab's rows and their reasons, the World Editor's "has a row here" check, the canvas pick marks, and the canvas routine view where it lists the places a routine uses.

Corrections that land here (Q9):

- **The Presence tab (#1).** An entity that begins at Player's Starting Location never shows on a starting location's Presence tab. It shows on each starting location, or on every location when none is flagged, with "begins here" as its reason.
- **Canvas pick marks (#2).** With Known In picks, the marks miss Player's Starting Location and Can Also Go and skip the path check that the Nearby mode applies. Both modes mark the entity's Presence places the same way.

The reason wording on the Presence tab stays as it is ("begins here (50%)", "stays here (…)", "can be led here"). The places and the reason kinds come from Presence; the tab only words them. A row place with no path from its Start no longer gives a row (Q8).

Two computations go because Presence replaces them: the Presence tab's private walk over Starts and rows, and the canvas pick's own "routine places" function. Presence Rows rulings stay in force: the tab's selection, the editor region, Add Entity and the remove button do not change.

Add both readers to the agreement test. The Locations wiki page changes where it says who is listed on the Presence tab.

Spec rulings: Q7, Q8, Q9 (#1, #2). Presence Rows Q2.

## Acceptance criteria

- [x] A Unique entity whose only Start is Player's Starting Location has a row on the Presence tab of each flagged starting location, with "begins here". The test fails with the old read. (locationPresenceReasons.test.ts "begins at each flagged starting location"; red on the old read.)
- [x] With no location flagged, that entity has a row on every location's Presence tab. ("begins at every location when none is flagged".)
- [x] A row place with no path from its Start gives no row on that place's Presence tab. ("gives no line for a row place with no path from its Start"; red on the old read.)
- [x] For one picked entity, the set of locations the canvas marks as its routine equals the set of locations whose Presence tab lists it, under Nearby and under Known In picks. A test compares the two sets. (Agreement test: the Presence tab, the canvas under Nearby and the canvas under Known In picks all match Presence at every place, for every cast entity.)
- [x] The canvas marks a Can Also Go place for a Unique entity, and marks nothing extra when Can Also Go is Anywhere. (entityPicking.test.ts, under Nearby and under Known In picks.)
- [x] The reason texts on existing rows are unchanged for the bundled worlds, apart from the rows the two corrections add or remove. A test compares before and after. (locationPresenceReasons.bundled.test.ts against a golden recorded at Base; no bundled entity uses Player's Starting Location and no bundled row is out of reach, so zero change.)
- [x] The two replaced computations are gone and nothing else calls them. (The tab's `routineReasons`/`rowPlaces` and `entityPicking.routinePlaces` are deleted; typecheck green.)
- [x] The agreement test holds both readers.
- [x] Frames: `.scratch/frames/presence-tab-player-start.png` (a starting location's Presence tab with a Player's Starting Location entity) and `.scratch/frames/canvas-pick-known-in.png` (canvas marks under Known In picks), dark theme, 1440 wide. (Viewport 1440×900; the pane captured its 800×600 top-left. Emberwatch with Mother Hesk moved to Player's Starting Location; DOM read confirmed the marks.)
- [x] The Locations wiki page matches.
- [ ] A changelog fragment records the two fixes.

Spec rulings added after this ticket was written: Q18 (rows of a Start at Player's Starting Location get no path check; the canvas keeps that), Q22.

## Landed

**Not verified**

- A changelog fragment: none, by Q25 (entity kinds are unreleased). The fixes for the spec session to fold in at close:
  - A location's Presence tab lists an entity that begins at Player's Starting Location: on each Starting Location, or every location when none is flagged.
  - A row's location its Start can't reach is no longer listed on the Presence tab.
  - The Locations Canvas marks the same locations as the Presence tab under every Known In setting, Can Also Go included.
  - "begins here (N%)" counts a Player's Starting Location Start only when it stands for one place (Q27).

**Notes**

- Q23: `routineView` (`src/lib/canvasRoutine.ts`) is untouched. It still marks nothing at the starting locations for a selected Start at Player's Starting Location, so it can disagree with the Presence tab beside it. Open item, not in this ticket.
- Morphie's location pages (`worldIndex.ts`) read `presenceLines`, so they pick up both corrections and Q27 here. `worldIndex.test.ts` now expects "begins here" at Old Mill for Warden's Player's Starting Location Start.
- `pickMarks` with Picked Locations chosen and no pick yet now marks Presence, not the stored list; its old test asserted the stored list and is corrected.
- `WorldEditor.locationPresence.test.tsx`: its Rats row named an unlinked Cellar, which Q8 now drops. The fixture links the Cellar to the Yard so the row it describes reaches.

**For you**

- Open a world with an entity whose Start is Player's Starting Location. Check its row on a Starting Location's Presence tab and its canvas marks under Picked Locations. Frames: `.scratch/entity-places-06/frames/presence-tab-player-start.png`, `.scratch/entity-places-06/frames/canvas-pick-known-in.png`.
