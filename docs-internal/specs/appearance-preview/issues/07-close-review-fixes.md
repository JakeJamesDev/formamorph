# 07: Close Review Fixes

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Three gaps and four Standards findings from the close review of tickets 01–06. Each is a small change in code that exists.

## What to build

**Gaps**

- **Other Colors undo.** The spec says: "Its undo is enabled only while the selected material has an applied color, and it removes that color." Today the row compares its value to its base. When the viewer reports no calculated color for the material, the base follows the picked value and the undo never enables. Enable it by whether the material has an applied color.
- **Avatar icon in trait selection.** The spec says the icon shows "only when the owner's Avatar is in use". For a cast entity, trait selection reads whether the entity has an Avatar pick at all. The game resolves the pick. A pick that names a missing Avatar shows the icon in trait selection and none in the game. Make trait selection resolve the pick as the game does, from one shared check.
- **Avatar choice with alias-named sliders.** Ticket 06 says: "Changing the Avatar keeps the unsaved changes." When two Avatars name one slider by different aliases, Save writes the second Avatar's opening value over an edit made on the first. An edit must reach the row whichever alias an opened Avatar uses, and an Avatar the author did not edit on must never overwrite it.

**Standards**

- The stat Preview's note uses "in play". The glossary lists that term under words to avoid. Rewrite the note from the Writing Guide and list the final words under For you.
- The `EyeDropper` cast in the color picker goes through `unknown` with no comment. Add the one-line comment.
- The color picker calls the pick-end callback after an unmount in the middle of a pick. Check the mounted ref first, as the commit path above it does.
- The dev fixture for the Preview uses its own live flag. Use `useMountedRef`.

## Acceptance criteria

- [ ] A material with no calculated color: after a pick, its undo is enabled, and a click removes the applied color and disables the undo.
- [ ] A material whose applied color equals its calculated color still has its undo enabled.
- [ ] A cast entity whose Avatar pick names a missing Avatar shows no icon in trait selection. One with a resolved Avatar shows it.
- [ ] Trait selection and the game use one check for "Avatar in use" for an entity.
- [ ] Two Avatars that name one slider by different aliases: a drag on the first, a switch to the second, and Save writes the drag.
- [ ] The same case with a drag on the second Avatar writes that drag.
- [ ] An unmount in the middle of a pick calls no pick-end callback.
- [ ] Mutation: restore the value-to-base compare on the Other Colors row, and the no-calculated-color test fails.
- [ ] Mutation: restore the pick-exists check in trait selection, and the missing-Avatar test fails.
- [ ] Mutation: let a later Avatar write its opening value, and the alias test fails.

For you: read the stat Preview's new note.
