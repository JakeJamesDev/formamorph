# 10: Dictionary tab and library dictionary tree on the List Editor

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: a two-level tree with its own drag and add rules, plus new search.

Parent: [List Editor Shell spec](../spec.md)

## What to build

The **Dictionary** tab runs on the List Editor. Its search, ignored today, lists matching books and entries. The library dictionary modal's book tree uses the same shell. Rulings Q10, Q16, Q23.

## Acceptance criteria

- [ ] The dictionary tree, its drag, per-book add entry, delete confirmation and collapse behave as before.
- [ ] Search lists matching books and entries flat through the shared match; selecting one opens its details.
- [ ] The library dictionary modal's tree runs on the shell with the same behavior.
- [ ] Bench and rendered modal tests cover search. Existing tests pass unchanged.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Record any behavior drift found in `drift.md` (Q18), with the old behavior kept.
