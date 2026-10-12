# 05: Test Bench for stat gates

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: three rules on the pure rules seam with a fire/silent twin each, following the existing trait-rule patterns.

Parent: [Image Visibility Rules spec](../spec.md)

## What to build

Test Bench catches the stat-gate traps before a player does (Q13, Q20, Q22).

- The existing unresolved-requirement rule learns the stat kind: a rule that names a stat no bearer has reports there. No separate missing-stat rule.
- `trait-gate-reads-own-stat`: a trait's gate reads a stat the trait changes, including changes to that stat's min or max and stat toggles.
- `requirement-percent-zero-span`: a percent Condition on a stat whose min equals its max.
- The static analyses (never unlockable, dead rows, unstable cycles) treat a stat Condition as satisfiable both ways, so no stat-gated trait is reported never-unlockable. Ticket 01 lands the analysis change; this ticket proves the rules read it.

## Acceptance criteria

- [ ] Each rule fires on a minimal world and stays silent on its clean twin.
- [ ] Reads-own-stat fires for a value change, a max change and a stat toggle.
- [ ] A stat-gated trait with a reachable threshold is not reported never-unlockable; a trait-only conflicting row still is.
- [ ] Rule copy follows the Test Bench voice (what is wrong, where, what to do).
- [ ] Changelog fragment written. Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
