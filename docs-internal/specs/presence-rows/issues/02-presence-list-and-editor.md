# 02: Presence List And Editor

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

On a location's Presence tab, Entities Here becomes a list the author selects from, with one editor region under it. The selected entity is the shared pick of ticket 01, so the canvas beside the panel shows its routine.

- **The list.** One row per entity the presence-line model lists for this location, in its order. A row shows the name and the reasons on one line; the reasons cut off when they do not fit. The Open Routine button stays at the row's end. The list does not move or grow when a row is selected.
- **Selection.** One entity at a time. None when the tab opens. The selected row has the Design System's selected-row look. Selecting the selected row, or the close button in the editor region, clears it. The rows work from the keyboard.
- **The editor region.** Under the list, for the selected entity: its name, a close button, and the card body from ticket 01 (Routine and Known In). With no selection, one hint line says what selecting does.
- **The canvas link.** Selecting sets the shared pick and puts it on show; the canvas beside the panel draws it. Clearing the selection clears the pick.
- **Another location (Q10).** A click on a location on the canvas selects that location as today. On its Presence tab the same entity is selected when it has a row there. With no row, the pick clears.
- **Full screen (Q11).** Leaving full screen with a pick selects that entity on the Presence tab when the tab is on screen and the entity has a row.
- **Another tab (Q12).** A change to another tab of the location panel clears the pick.
- **No canvas.** In the list view and on a narrow screen the list and the editor work with no map.
- **Kept for now.** The Generic multi-select stays above the list in this ticket. Ticket 03 replaces it. The Known Here list is untouched.

**From ticket 01:** the pick is World Editor state with a `shown` input that only the dev route sets today; this ticket sets it from the Presence tab. The card body is its own component. While a pick is shown, the Drag To Connect grips are hidden (Q23), and Escape does not clear the pick (Q22).

The prototype's variant B shows the layout: branch `prototype/presence-rows`, `?variant=B`. Its copy is placeholder text. Write the hint and labels under the Writing Guide from a facts list.

Spec rulings: Q2, Q3, Q4, Q6, Q10, Q11, Q12, Q16.

## Acceptance criteria

- [x] A location with a Unique entity that begins there, a Generic entity with a Start there, and an entity there only through Can Also Go lists three rows, each with its reasons. The Custom Persona has no row. (`WorldEditor.locationPresence.test.tsx`, "has a row for a Unique entity…")
- [x] No row is selected when the tab opens. ("opens with no row selected…")
- [x] Selecting a row shows that entity's Routine editor under the list, and the Routine and Known In switch changes the body. ("shows the selected entity’s Routine editor…")
- [x] Selecting a second row replaces the first. Selecting the selected row, and the close button, each clear the selection. ("replaces the selection…"; mutation of the toggle goes red)
- [x] The rows before and after the selected row keep their positions when a row is selected (the list's height does not change). (e2e "a selected row keeps every row where it was", bounding boxes)
- [x] With a row selected, the canvas beside the panel has the routine marks and the key. With none, it has neither. (e2e "a selected row draws its routine and the key…")
- [x] Selecting a routine row in the editor narrows the canvas marks to that row's locations. (e2e "a routine row selected in the editor…": status "Locations of this row" and the row's tone; every box carries a mark, so the count cannot show it)
- [x] A click on a location where the entity also has a row leaves the entity selected on that location's Presence tab. A click on a location where it has none clears the pick. Each test fails when the pick is left as it was. (e2e "a click on a location selects it…" and "a location where the entity has no row clears the pick"; unit "keeps the entity selected at another location…"; removing the clear turns the unit test red)
- [x] A change to the Connections tab and back shows no selection and no marks. (e2e and unit tab-change tests)
- [x] Leaving full screen with a picked entity that has a row here shows that row selected. (e2e "an entity picked in full screen is selected…"; both exit mutations go red)
- [x] Arrow keys move through the rows and Enter or Space selects. ("moves through the rows with the arrow keys…")
- [x] The copy sweep gives no notice on the new strings. (`npm run copy:sweep` on the changed files, filtered to the changed lines)
- [x] Frames: `.scratch/frames/presence-list-dark.png` and `-light.png`, at 1440 wide, on the `entityPresence` fixture at The White Room with one row selected and the canvas view on. (Playwright at 1440×900, Warden selected)
- [x] The Locations wiki page describes the list, the editor region and the canvas link; the Entities wiki page no longer says a place is set only on the Routine tab. Help vectors are rebuilt for the changed sections. A changelog fragment describes the change.

For you: select three entities in turn on The White Room and say whether the canvas beside the panel is readable at the panel's default width.

## Landed

- Rulings for this ticket: Q24 (Custom Prompts selected-row look), Q25 (leaving Locations clears), Q26 (outside full screen a pick lives only as a selected Presence row), Q27 (any location change, the tree included).
- `useEntityPick` derives `shown` from the open Presence tab and clears the pick when it stops being shown outside full screen, or when full screen closes on a pick with no row here. The dev route's `pick=` now needs `fullscreen=1`.
- Ticket 01's e2e now selects through the Presence row. Its hidden-pick test became the Q26 clear; the Rats fixture got a Start at the Island so a canvas click keeps the pick.
- An edit in the editor that removes the entity's last reason to be here removes its row, so the editor closes. Ticket 05 rules the same for an undo.
- Help vectors: only this ticket's three sections. `World-Editor-Openings#the-openings-tab`, `World-Editor-Locations#list-and-canvas` and `#connections` were already stale on main and stay so.

**Not verified**

- None.

**For you**

- select three entities in turn on The White Room and say whether the canvas beside the panel is readable at the panel's default width. Frames: `.scratch/presence-rows-02/frames/presence-list-dark.png`, `presence-list-light.png`.
- The unselected rows' Open Routine buttons draw a border; the selected row's does not. It is the ghost icon button's existing look; check that it reads well on the accent fill.
