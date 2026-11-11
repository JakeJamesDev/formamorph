# 04: Marks For This Location

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The editor under the Presence list shows an entity's whole routine, not only the part at this location. Mark the parts that name this location, so the author sees why the entity is listed.

- **Starts.** Each Start that begins at this location, or has a row that names it, gets a mark on its Start button.
- **Rows.** Each routine row that names this location gets a mark.
- **Can Also Go.** When the list names this location, that entry gets a mark.
- **Opens on the right Start.** On selection the editor shows the first Start that names this location. With none (the entity is here only through Can Also Go), it shows the first Start.
- **Only here.** The Routine editor takes the location to mark from its host. The entity panel's Routine tab and the full-screen entity card pass none and show no mark.

The mark is a new visual pattern. Follow the Design System, propose the look to the user with frames, and get approval before the landing. The prototype used a small dot on the Start button; it is not approved.

Spec ruling: Q7.

## Acceptance criteria

- [ ] For an entity with two Starts where only the second names this location, the second Start button has the mark, the first has none, and the editor opens on the second.
- [ ] A Stay, a Wander and a Patrol row that name this location each have the mark; a row that names other locations has none.
- [ ] An entity here only through Can Also Go has the mark on that entry and opens on its first Start.
- [ ] The entity panel's Routine tab and the full-screen entity card show no mark for the same entity.
- [ ] The mark has an accessible name or description, so a screen reader hears it.
- [ ] The Design System page lists the mark after the user approves it.
- [ ] Frames: `.scratch/frames/presence-here-marks-dark.png` and `-light.png`, at 1440 wide, with a marked Start, a marked row and a marked Can Also Go entry in view.
- [ ] The Locations wiki page says what the mark means. Help vectors are rebuilt for the changed section. A changelog fragment describes the change.

For you: approve the mark's look from the frames before the landing.
