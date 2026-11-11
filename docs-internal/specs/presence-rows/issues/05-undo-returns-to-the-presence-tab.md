# 05: Undo Returns To The Presence Tab

Status: ready-for-human
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
- [ ] The same undo with the location panel on its Connections tab returns to the Presence tab and selects the entity (Q31).
- [ ] The same undo with another location selected returns to the Origin's location and selects the entity (Q31).
- [ ] Undo of an Add Entity leaves the Presence tab on screen with no selection and no marks on the canvas.
- [x] A hook-level test, beside the Connection-row reveal tests, fails when the Presence case is removed. `the Presence entity request` in `useHistoryReveal.test.tsx`.
- [x] A request nobody took does not select a row on a later visit. The test fails when the request is kept. Proved by removing the drop: `drops a request nobody took when the next move follows` went red.
- [x] The World Editor wiki page's text on undo matches. A changelog fragment describes the change. `docs/World-Editor-Locations.md`, `docs-internal/changelog.d/presence-rows-05.md`.

## Landed

Q31 changed criteria 2 and 3: the Step's Origin wins, so an undo of a Presence edit returns to the Origin's location and tab whatever is on screen, and selects the entity there. The ticket text above is updated.

**Not verified**
- Criteria 1 to 4 end to end in the editor. Covered by hook and pick-state tests (`useEntityPick.test.tsx`: row selects in the requested mode, no row leaves no pick, request waits for the tab). No DOM test drives undo through the whole World Editor.
- Q28, showing the Start of the change on arrival. The shown-Start state belongs to ticket 04, so the reveal does not set it. After 04 lands, the request needs the Start id from the Origin field (`starts/<id>/...`).

**For you**
- Edit a routine row under a location's Presence list, switch to Connections, press Ctrl+Z. Look for the Presence tab with that entity selected.
- Add an entity there, press Ctrl+Z. Look for the Presence tab with no entity selected and no marks on the canvas.
