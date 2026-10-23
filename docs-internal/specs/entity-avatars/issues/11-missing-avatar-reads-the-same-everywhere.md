# 11: Missing Avatar Reads the Same Everywhere

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: low

Opus at low: one dropdown option and one label source, with tests.

## What to build

A library Avatar pick whose id this device lacks reads "Missing Avatar" in the library entity's Avatar dropdown, as it already does in the link review (spec: Post-Close Rulings, Q26). Today the dropdown shows None, which hides that a pick exists. Play keeps showing the bundled file (T02-5). Choosing another option replaces the missing pick.

## Acceptance criteria

- [ ] The library entity dropdown shows a "Missing Avatar" option, selected, when the pick's library id is absent.
- [ ] The link review and the dropdown use one label source.
- [ ] Choosing None, User's Default or a library Avatar replaces the missing pick.
- [ ] A missing world store id still reads None (T02-4).
- [ ] Tests cover both readings and fail when the dropdown falls back to None again.
- [ ] Changelog fragment.
