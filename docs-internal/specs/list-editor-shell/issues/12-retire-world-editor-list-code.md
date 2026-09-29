# 12: Retire the World Editor's own list code

Status: ready-for-human
Base: 038bd463
Blocked by: 04, 07, 08, 09, 10
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: the contract step; mostly deletion, checked by the full suite.

Parent: [List Editor Shell spec](../spec.md)

## What to build

Every list tab runs on the List Editor, so the World Editor's own list code goes: the inline flat list, the shared filtered items, the shared selection, and the per-tab list and detail branches. The drift log is complete for review. Rulings Q17, Q18.

## Acceptance criteria

- [ ] The World Editor has no per-tab list, search or detail branches left outside the adapters.
- [ ] No caller of the removed code remains.
- [ ] `drift.md` lists every drift found across the effort, each with a proposed ruling.
- [ ] Existing tests pass unchanged.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Record any behavior drift found in `drift.md` (Q18), with the old behavior kept.
