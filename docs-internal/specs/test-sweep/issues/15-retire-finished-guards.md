# 15: Retire Finished Guards

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: Needs release-state proof per guard and care around Q5 parity.

Parent: [Test Sweep spec](../spec.md)

## What to build

Rename guards and parity suites retire when their change is released, except parity that still pins Q5 behavior (Q11). Prove released state with `git merge-base --is-ancestor` against a release tag, not by commit. Keep a guard whose change has not been released. Update selection lists and triggers to match.

Rulings: Q5, Q9, Q11.

## Acceptance criteria

- [ ] Each retired guard is listed with its release proof and reason.
- [ ] Each kept parity suite is listed with the Q5 behavior it pins.
- [ ] No selection list or trigger names a removed file.
