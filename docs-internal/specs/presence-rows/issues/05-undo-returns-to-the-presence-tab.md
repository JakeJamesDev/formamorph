# 05: Undo Returns To The Presence Tab

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An undo or redo shows the author the change it made. For an entity's routine or Known In, that is the entity's own panel today. An edit made in the Presence editor region must come back to that region.

- When the step's target is an entity field, the Locations section is on screen with a location selected on its Presence tab, and the entity has a row at that location: select the entity there. The author stays on the location.
- Otherwise the entity's panel opens on the right tab, as today.
- A step that removes the entity's row at this location (for example the undo of an add) leaves the Presence tab on screen with no selection.
- A request to select that nobody took is dropped on the next move, as the Connection-row request is.

**From ticket 02:** outside full screen a pick exists only as a selected Presence row (Q26), and the pick clears when the Presence tab stops showing it. So the reveal must put the Presence tab on screen before it sets the pick. An edit that removes the entity's last reason to be here already removes its row and closes the editor.

This follows the existing Connection-row reveal in the history reveal hook.

Spec ruling: Q15.

## Acceptance criteria

- [ ] After an edit to a routine row made in the Presence editor region, undo leaves the Locations section and the Presence tab on screen with that entity selected.
- [ ] The same undo with the location panel on its Connections tab opens the entity's Routine tab.
- [ ] The same undo for an entity with no row at the selected location opens the entity's Routine tab.
- [ ] Undo of an Add Entity leaves the Presence tab on screen with no selection and no marks on the canvas.
- [ ] A hook-level test, beside the Connection-row reveal tests, fails when the Presence case is removed.
- [ ] A request nobody took does not select a row on a later visit. The test fails when the request is kept.
- [ ] The World Editor wiki page's text on undo matches. A changelog fragment describes the change.
