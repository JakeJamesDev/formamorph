# 07: Stats tab on the List Editor

Status: ready-for-human
Base: 052dc486
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: a flat sortable list on ticket 03's seam, plus a scoped deletion.

Parent: [List Editor Shell spec](../spec.md)

## What to build

The **Stats** tab runs on the List Editor with no visible change. The unreachable Stat Updates editor code goes. Rulings Q10, Q24.

## Acceptance criteria

- [x] The sortable list, search, single **+**, duplicate, delete and stat details behave as before.
- [x] The World Editor's Stat Updates branches and `StatUpdatesManager` are deleted. The world's `statUpdates` field and its readers stay.
- [x] `drift.md` records the Stat Updates idea from the spec for a later ruling.
- [x] Existing tests pass unchanged.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Record any behavior drift found in `drift.md` (Q18), with the old behavior kept.
