# 02: Return focus when Find closes in the World Editor

Status: in-progress
Base: c87369b8
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Focus assertions in jsdom trap easily, and the host owns focus return across several close paths. A stronger model reduces the chance of a green test that does not prove the behavior.

## Parent

[spec.md](../spec.md), item 3.

## What to build

A World Editor author opens Find with the keyboard shortcut while typing in a field. They close it with Escape or the Close action. Focus returns to the field they were in. If that field no longer exists, focus lands on a stable editor container, never the document body.

The Find bar component does not change. The host records the active element before Find opens and restores it on close, as the guide's Compact Find Utility Bar section already requires.

## Acceptance criteria

- [ ] Open Find from a focused field, close with Escape, and focus is back on that field.
- [ ] Open Find from a focused field, close with the Close action, and focus is back on that field.
- [ ] Remove the original field before closing, and focus lands on the stable fallback, not the body.
- [ ] Find and Replace opened with its own shortcut behaves the same.
- [ ] Both cases live in an existing World Editor or Find bar suite and fail when the focus return is removed.
- [ ] The four gates pass. One In Progress changelog entry in the dev-tooling bucket.

## Blocked by

- None — can start immediately.
