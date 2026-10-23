# 11: Missing Avatar Reads the Same Everywhere

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: low

Opus at low: one dropdown option and one label source, with tests.

## What to build

A library Avatar pick whose id this device lacks reads "Missing Avatar" in the library entity's Avatar dropdown, as it already does in the link review (spec: Post-Close Rulings, Q26). Today the dropdown shows None, which hides that a pick exists. Play keeps showing the bundled file (T02-5). Choosing another option replaces the missing pick.

## Acceptance criteria

- [x] The library entity dropdown shows a "Missing Avatar" option, selected, when the pick's library id is absent. `EntityEditorModal.avatar.test.tsx` "shows a library id this device lacks…".
- [x] The link review and the dropdown use one label source. The dropdown names the option with `pickLabel`.
- [x] Choosing None, User's Default or a library Avatar replaces the missing pick. `it.each` "replaces a missing pick with %s".
- [x] A missing world store id still reads None (T02-4). `WorldEditor.worldAvatars.test.tsx` "reads a store id the store lacks as None".
- [x] Tests cover both readings and fail when the dropdown falls back to None again. Reinstating the fallback failed 4 tests.
- [x] Changelog fragment. `docs-internal/changelog.d/entity-avatars-11.md`.

## Landed

**Not verified:** none.

**For you:**
- An unreadable Avatar library still shows a missing pick as None, since the app can't tell the id is absent. Library entity editor, Avatar dropdown.
