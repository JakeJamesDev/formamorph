# 06: Library modals' Placeholders on the List Editor

Status: ready-for-human
Base: 1be058f6
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: reuses ticket 05's adapter; the new part is reading a card's carried blueprints without writing them.

Parent: [List Editor Shell spec](../spec.md)

## What to build

The library entity and dictionary modals' Placeholders tabs run on the List Editor, side by side, with search and a named add. In the library entity modal a copy opens the copy editor over the blueprints the card carries, read-only, with no **Edit Blueprint**. The old placeholder editor is gone. Rulings Q1, Q6, Q13.

## Acceptance criteria

- [x] Both modals show the toolbar, search and side-by-side layout.
- [x] The entity modal reads the card's own blueprints for the copy editor and never writes them. No card shape changes.
- [x] A copy whose blueprint the card doesn't carry shows a clear notice, not a raw edit.
- [x] The old `PlaceholderEditor` has no callers and is deleted.
- [x] Rendered modal tests cover search, add, and the copy editor. Existing modal tests pass unchanged.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Record any behavior drift found in `drift.md` (Q18), with the old behavior kept.
