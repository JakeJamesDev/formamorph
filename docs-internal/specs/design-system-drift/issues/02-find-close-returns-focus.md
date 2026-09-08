# 02: Return focus when Find closes in the World Editor

Status: ready-for-human
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

- [x] Open Find from a focused field, close with Escape, and focus is back on that field.
- [x] Open Find from a focused field, close with the Close action, and focus is back on that field.
- [x] Remove the original field before closing, and focus lands on the stable fallback, not the body.
- [x] Find and Replace opened with its own shortcut behaves the same.
- [ ] Both cases live in an existing World Editor or Find bar suite and fail when the focus return is removed. (Partial: they fail when the return is removed, but live in a new topic suite. See Comments.)
- [x] The four gates pass. One In Progress changelog entry in the dev-tooling bucket.

## Blocked by

- None — can start immediately.

## Comments

Done in `ccf08151`, review fixes in `69a72664`.

The host owns both ends. `openFind` records `document.activeElement`; `closeFind` restores it before the
bar unmounts, because removing a focused node drops focus on the body. `EditorFindBar` is unchanged.

Deviation from the acceptance list: the cases live in a new file,
`src/views/WorldEditor.findFocus.test.tsx`, not an existing suite. The existing World Editor suites carry
their own fixtures and per-file mocks for other topics, and the repo already splits them by topic
(`WorldEditor.fix`, `WorldEditor.discard`, `WorldEditor.tutorial`). Say so if you want them merged instead.

Six cases, each proven by mutation: dropping the restore fails all six, dropping the fallback fails one,
dropping the re-entrancy guard fails one.
