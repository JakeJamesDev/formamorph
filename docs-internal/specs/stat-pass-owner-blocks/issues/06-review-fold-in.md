# 06: Review Fold-In

Status: ready-for-agent
Blocked by: 01, 02, 03, 04, 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a review across five landed tickets against the spec and the repo standards, then the fixes it names.

Parent: [Stat Pass Owner Blocks spec](../spec.md)

## What to build

The closing review of tickets 01 to 05 against this spec, folded in as one unit. The review runs from the first ticket's base and reports on both axes: the repo's standards and this spec's rulings. Should-fix findings and nits land here with the tests the spec's Testing Decisions call for that no earlier ticket wrote.

Rulings: all.

## Acceptance criteria

- [ ] The review's should-fix findings are folded in or recorded as wontfix with a reason.
- [ ] Every test seam the spec names has a test that bites when its behavior is reverted.
- [ ] All four gates are green on main after the landing.
