# 07: Stats tab on the List Editor

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: a flat sortable list on ticket 03's seam, plus a scoped deletion.

Parent: [List Editor Shell spec](../spec.md)

## What to build

The **Stats** tab runs on the List Editor with no visible change. The unreachable Stat Updates editor code goes. Rulings Q10, Q24.

## Acceptance criteria

- [ ] The sortable list, search, single **+**, duplicate, delete and stat details behave as before.
- [ ] The World Editor's Stat Updates branches and `StatUpdatesManager` are deleted. The world's `statUpdates` field and its readers stay.
- [ ] `drift.md` records the Stat Updates idea from the spec for a later ruling.
- [ ] Existing tests pass unchanged.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Record any behavior drift found in `drift.md` (Q18), with the old behavior kept.
