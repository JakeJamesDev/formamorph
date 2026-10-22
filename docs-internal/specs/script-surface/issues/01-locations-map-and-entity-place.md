# 01: Locations Map And Entity Place

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: it reshapes the places input every later ticket reads, touches the prelude, the snapshot builder for play and the editor, the hover cards and the Variable menu.

## What to build

A script reads `locations`, a map of the world's locations by name, each entry with `id`, `name`, `description`, `summary`, `starting` and `present` (spec: Surface, Locations). `location` is the current location's entry with the same fields plus `move`; in a world with no location its `id` and `name` are empty and `present` is empty (R1). `present` holds the same entry objects `entities` holds, the persona first when the player stands there, then the entities in `entities` order; an entity with no runtime position appears at every location it lists (Q11, Q19, Q20). Every entity entry, `owner` and `persona` gain `location`, the name of where the entity stands with a follower reading the player's location and an unplaced entity reading empty, `following`, `description`, `summary` and `aliases` (Q5, Q20). The Sandbox Snapshot carries the new inputs for play and for the editor's run; the hover cards and the Variable menu show the new map, the entry fields and the current entry.

Spec: R1, Q5, Q10, Q11, Q19, Q20, stories 1 to 4.

## Acceptance criteria

- [x] A script reads `locations["Old Mill"].present.map((e) => e.name)` and gets the entities there, persona first when the player is there; a test places one entity, leaves one unplaced listing two locations, and asserts both lists — `statCodeExecutor.locations.test.ts` "lists who stands at each location"; play path in `sandboxSnapshot.locations.test.ts`
- [x] `location` has every field a `locations` entry has plus `move`; `locations[location.name] === location` is false but their fields agree, and a world with no location reads empty `id`, `name` and `present` — executor tests "gives location the entry fields plus move" and "reads an empty location in a world with none"
- [x] `entities.Mira.location` reads her place, reads the player's location while she follows, and reads empty when unplaced; `following` reads true only while she follows — executor and snapshot "reads where each entity stands" tests
- [x] `description`, `summary` and `aliases` read on an entity entry and `description`, `summary` on a location entry, from the authored text — chips resolved per Q30; snapshot "reads entity and location text with its chips resolved" for play and the editor
- [x] Hover cards and the Variable menu list `locations`, its entry fields, `location` and the new entity fields, with help lines in the guide voice — `codeCards.location.test.ts` "the cards of a locations read", `statCodeVariableTree.test.ts` (every leaf runs), `statCodeAnalysis.locations.test.ts`
- [x] The editor's Test Code and the Test Bench read the authored world's locations with an empty `present` except the starting location's persona — read per Q29: unplaced entities stand at each location they list; snapshot "stands at the starting location" test over `openingStateOf`
- [ ] Four gates green — prepare runs them

## Blocked by

- None (can start immediately)

## Landed

**Not verified**

- Four gates green: prepare runs the full list after this hand-off.
- Editor chip rolls: `turnOneText` keeps its own roll store, so an unrolled multi-value chip can read one value in `entities.X.description` and another in `placeholders.X.text` in one Test Code run.

**For you**

- Open a script box's Variable menu: **Locations** lists the world's locations, each with its fields, and **Location** shows the new fields. Hover `locations.<Location>.present` and `entities.<Entity>.location` for their cards.
- Follow-up: once ticket 02 lands, `StatCodeRunOptions.discovered` has no producer (discovered characters are real `entities` entries now), so it and its part of the `diary` cast can go.
- A name two locations share: the `locations` key keeps the later one (the `entities` rule), while `location.move` and its card keep the first.
