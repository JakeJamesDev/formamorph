# 01: Locations Map And Entity Place

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: it reshapes the places input every later ticket reads, touches the prelude, the snapshot builder for play and the editor, the hover cards and the Variable menu.

## What to build

A script reads `locations`, a map of the world's locations by name, each entry with `id`, `name`, `description`, `summary`, `starting` and `present` (spec: Surface, Locations). `location` is the current location's entry with the same fields plus `move`; in a world with no location its `id` and `name` are empty and `present` is empty (R1). `present` holds the same entry objects `entities` holds, the persona first when the player stands there, then the entities in `entities` order; an entity with no runtime position appears at every location it lists (Q11, Q19, Q20). Every entity entry, `owner` and `persona` gain `location`, the name of where the entity stands with a follower reading the player's location and an unplaced entity reading empty, `following`, `description`, `summary` and `aliases` (Q5, Q20). The Sandbox Snapshot carries the new inputs for play and for the editor's run; the hover cards and the Variable menu show the new map, the entry fields and the current entry.

Spec: R1, Q5, Q10, Q11, Q19, Q20, stories 1 to 4.

## Acceptance criteria

- [ ] A script reads `locations["Old Mill"].present.map((e) => e.name)` and gets the entities there, persona first when the player is there; a test places one entity, leaves one unplaced listing two locations, and asserts both lists
- [ ] `location` has every field a `locations` entry has plus `move`; `locations[location.name] === location` is false but their fields agree, and a world with no location reads empty `id`, `name` and `present`
- [ ] `entities.Mira.location` reads her place, reads the player's location while she follows, and reads empty when unplaced; `following` reads true only while she follows
- [ ] `description`, `summary` and `aliases` read on an entity entry and `description`, `summary` on a location entry, from the authored text
- [ ] Hover cards and the Variable menu list `locations`, its entry fields, `location` and the new entity fields, with help lines in the guide voice
- [ ] The editor's Test Code and the Test Bench read the authored world's locations with an empty `present` except the starting location's persona
- [ ] Four gates green

## Blocked by

- None (can start immediately)
