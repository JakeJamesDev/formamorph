# 07: Close Review Fixes

Status: ready-for-human
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

- [x] A material with no calculated color: after a pick, its undo is enabled, and a click removes the applied color and disables the undo. (`useVrmCustomization.test.tsx` "enables undo after a pick on a material with no calculated color…")
- [x] A material whose applied color equals its calculated color still has its undo enabled. (same file, "keeps undo enabled when the applied color equals the calculated color")
- [x] A cast entity whose Avatar pick names a missing Avatar shows no icon in trait selection. One with a resolved Avatar shows it. (`enterFlow.test.ts` "shows the icon for a cast entity whose Avatar resolves…", plus the library-cast case)
- [x] Trait selection and the game use one check for "Avatar in use" for an entity. (`entityAvatarInUse` in `vrmResolver.ts`, called by `entryAvatarInUse` and `usePlayAvatars().inUse`; parity test against `playVrmContext` over three library states)
- [x] Two Avatars that name one slider by different aliases: a drag on the first, a switch to the second, and Save writes the drag. (`appearancePreview.test.ts` alias cases, with and without a row; `TraitManager.preview.test.tsx` alias dialog test)
- [x] The same case with a drag on the second Avatar writes that drag. (`appearancePreview.test.ts` "saves a drag on the second Avatar…")
- [x] An unmount in the middle of a pick calls no pick-end callback. (`color-picker.test.tsx` "calls no pick-end callback after an unmount in the middle of a pick"; fails with the guard removed)
- [x] Mutation: restore the value-to-base compare on the Other Colors row, and the no-calculated-color test fails. (both Other Colors tests failed)
- [x] Mutation: restore the pick-exists check in trait selection, and the missing-Avatar test fails. (three trait-selection tests failed)
- [x] Mutation: let a later Avatar write its opening value, and the alias test fails. (an exact-key lookup in `lookWithEdits` makes the later Avatar write its opening value; three module tests and the dialog test failed)

For you: read the stat Preview's new note.

## Landed

**Not verified**

- None. Every criterion has a test. No browser check: each change is logic or copy that the tests read.

**For you**

- For you: read the stat Preview's new note. It now reads "Adds these changes to the player's own slider values during the game". Open a stat's **Preview** in the World Editor (dev route `statAppearancePreview`). The same fact in [World-Editor-Stats.md](../../../../docs/World-Editor-Stats.md) now starts "During the game".
- Spec-session ruling on aliases: one control, one edit. The most recent drag wins, and the second Avatar shows the first Avatar's drag. A new row takes the first opened Avatar's slider name. Try it with two Avatars that name one slider differently (for example Weight and Fat).
