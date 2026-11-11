# 06: The Presence Tab and Canvas Read Presence

Status: ready-for-agent
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

- [ ] A Unique entity whose only Start is Player's Starting Location has a row on the Presence tab of each flagged starting location, with "begins here". The test fails with the old read.
- [ ] With no location flagged, that entity has a row on every location's Presence tab.
- [ ] A row place with no path from its Start gives no row on that place's Presence tab.
- [ ] For one picked entity, the set of locations the canvas marks as its routine equals the set of locations whose Presence tab lists it, under Nearby and under Known In picks. A test compares the two sets.
- [ ] The canvas marks a Can Also Go place for a Unique entity, and marks nothing extra when Can Also Go is Anywhere.
- [ ] The reason texts on existing rows are unchanged for the bundled worlds, apart from the rows the two corrections add or remove. A test compares before and after.
- [ ] The two replaced computations are gone and nothing else calls them.
- [ ] The agreement test holds both readers.
- [ ] Frames: `.scratch/frames/presence-tab-player-start.png` (a starting location's Presence tab with a Player's Starting Location entity) and `.scratch/frames/canvas-pick-known-in.png` (canvas marks under Known In picks), dark theme, 1440 wide.
- [ ] The Locations wiki page matches.
- [ ] A changelog fragment records the two fixes.
