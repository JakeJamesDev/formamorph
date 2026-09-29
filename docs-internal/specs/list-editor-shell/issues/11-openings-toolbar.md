# 11: Openings toolbar

Status: ready-for-human
Base: 144b063c
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: toolbar-only adoption over inline cards; no layout change.

Parent: [List Editor Shell spec](../spec.md)

## What to build

The world and entity Openings panels get the List Editor's toolbar: a search box that filters the cards and the **+** that adds an opening. The cards stay inline. Ruling Q20.

## Acceptance criteria

- [x] Both entity editors and the world Openings panel show the toolbar in place of their Add button.
- [x] Search filters the cards through the shared match; an empty match shows a no-match line.
- [x] Adding clears the box. Draw order, weights and chances behave as before.
- [x] Bench and rendered modal tests cover search and add. Existing tests pass unchanged.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Record any behavior drift found in `drift.md` (Q18), with the old behavior kept.
