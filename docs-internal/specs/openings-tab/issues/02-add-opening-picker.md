# 02: Add Opening Picker

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a + menu built from the existing Owner Flyouts parts, plus one new row variant and its Design System entry.

## What to build

The Openings tab's + menu gives a new owner its first opening (Q3, Q7, Q14).

- The menu has two drill-ins: **Location** and **Entity**. Each is disabled when nothing in it can be picked.
- **Entity** walks the entity folders one level at a time, as the Owner Flyouts do. It lists only entities with no openings. A folder with no pickable entity below it has no row.
- **Location** walks the location tree one level at a time. It lists only locations with no openings, plus parents that have one below them. A location with pickable sub-locations only opens its level. Inside that level, an **Add to <name>** row at the top adds the opening to that location itself, when it has none. A location without pickable sub-locations is a plain pick row.
- A pick adds one blank opening to that owner, closes the menu, lists the owner, and selects it.
- The placeholder + behavior from 01 goes away.
- Document the **Add to <name>** row and the Openings tab's dim context rows as variants in the Design System (Owner Flyouts and the editor list patterns). The user approved both through the prototype.

Reference: the prototype's variant B picker (spec, Further Notes).

## Acceptance criteria

- [ ] The Entity drill-in lists only entities without openings, in their folders (editor-bench test, mutation "list every entity" goes red)
- [ ] The Location drill-in lists only locations without openings and their parents; a parent opens its level, and its Add to row adds to the parent (editor-bench test)
- [ ] A pick adds one blank opening, closes the menu and selects that owner (editor-bench test)
- [ ] A drill-in with nothing to pick is disabled
- [ ] Keyboard: Back rows and pick rows are reachable, and focus moves to each level's Back row
- [ ] Frame `.scratch/frames/openings-picker.png` at 1280×800 dark, with a drilled location level showing its Add to row
- [ ] Design System entries added; a changelog fragment is written
