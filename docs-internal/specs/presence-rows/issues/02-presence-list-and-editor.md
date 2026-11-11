# 02: Presence List And Editor

Status: ready-for-agent
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

- [ ] A location with a Unique entity that begins there, a Generic entity with a Start there, and an entity there only through Can Also Go lists three rows, each with its reasons. The Custom Persona has no row.
- [ ] No row is selected when the tab opens.
- [ ] Selecting a row shows that entity's Routine editor under the list, and the Routine and Known In switch changes the body.
- [ ] Selecting a second row replaces the first. Selecting the selected row, and the close button, each clear the selection.
- [ ] The rows before and after the selected row keep their positions when a row is selected (the list's height does not change).
- [ ] With a row selected, the canvas beside the panel has the routine marks and the key. With none, it has neither.
- [ ] Selecting a routine row in the editor narrows the canvas marks to that row's locations.
- [ ] A click on a location where the entity also has a row leaves the entity selected on that location's Presence tab. A click on a location where it has none clears the pick. Each test fails when the pick is left as it was.
- [ ] A change to the Connections tab and back shows no selection and no marks.
- [ ] Leaving full screen with a picked entity that has a row here shows that row selected.
- [ ] Arrow keys move through the rows and Enter or Space selects.
- [ ] The copy sweep gives no notice on the new strings.
- [ ] Frames: `.scratch/frames/presence-list-dark.png` and `-light.png`, at 1440 wide, on the `entityPresence` fixture at The White Room with one row selected and the canvas view on.
- [ ] The Locations wiki page describes the list, the editor region and the canvas link; the Entities wiki page no longer says a place is set only on the Routine tab. Help vectors are rebuilt for the changed sections. A changelog fragment describes the change.

For you: select three entities in turn on The White Room and say whether the canvas beside the panel is readable at the panel's default width.
