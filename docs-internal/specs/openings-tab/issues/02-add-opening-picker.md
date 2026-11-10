# 02: Add Opening Picker

Status: done
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

- [x] The Entity drill-in lists only entities without openings, in their folders (editor-bench test, mutation "list every entity" goes red): "lists only entities the tab does not list, in their folders"; the mutation turned it red
- [x] The Location drill-in lists only locations without openings and their parents; a parent opens its level, and its Add to row adds to the parent (editor-bench test): "lists only locations the tab does not list…" and "adds one blank opening to a parent from its Add to row…"; ignoring `listed` turned them red
- [x] A pick adds one blank opening, closes the menu and selects that owner (editor-bench test): the Add to case and "adds one blank opening to a picked entity and selects it"; Q21 has its own test, red when the picker reads the filtered view
- [x] A drill-in with nothing to pick is disabled: "disables a drill-in with nothing to pick"
- [x] Keyboard: Back rows and pick rows are reachable, and focus moves to each level's Back row: the focus test drives both drill-ins by Tab and Enter; Back returns focus to the drill row
- [x] Frame `.scratch/frames/openings-picker.png` at 1280×800 dark, with a drilled location level showing its Add to row: headless Playwright on Veilwood, The Veilwood level
- [x] Design System entries added; a changelog fragment is written: Owner Flyouts (location levels, Add to row, empty drill-in, Openings instance) and the dim context row in Lists With Controls

## Landed

**Not verified**

- None.

**For you**

- The Add to row and the location levels in the + menu, at a drilled level: `.scratch/openings-tab-02/frames/openings-picker.png`.
- The live Design System showcase has no Openings picker sample; the entries are in `docs/Design-System.md` only.
