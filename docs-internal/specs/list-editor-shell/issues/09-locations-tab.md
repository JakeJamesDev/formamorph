# 09: Locations tab on the List Editor

Status: ready-for-human
Base: cae6ba8d
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: the canvas needs the shell's owns-its-slot mode; the list view is routine.

Parent: [List Editor Shell spec](../spec.md)

## What to build

The **Locations** tab runs on the List Editor with no visible change, in both the list view and the Locations Canvas. Ruling Q10.

## Acceptance criteria

- [x] The shell gains an owns-its-slot mode: no list scroll, no click-to-deselect. The canvas uses it and ignores search, as today.
- [x] The List/Canvas toggle sits in the toolbar as before.
- [x] The list view's tree, search and details behave as before.
- [x] Existing location and canvas tests pass unchanged.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Record any behavior drift found in `drift.md` (Q18), with the old behavior kept.
