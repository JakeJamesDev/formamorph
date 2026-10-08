# 04: Test Bench rules for rows and Not

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: graph logic with edge polarity on an existing pure seam; moderate reasoning, well-bounded.

Parent: [Trait Gate Rows spec](../spec.md)

## What to build

Test Bench catches the new traps. A requirement cycle that passes through a Not is an error, because the gate can never settle (Q13). A row that names a target both plain and Not, or a trait plain and its group Not under the same bearer, is a warning, because it can never hold (Q14). The existing rules read rows and Not: never-unlockable treats every Not Condition as holding (Q15), unresolved reports per Condition, and default-gated covers defaults that exclude each other (Q16).

## Acceptance criteria

- [ ] `trait-requirement-unstable` (error): a cycle in the requirement graph with at least one Not edge, per bearer. A cycle with no Not edge stays `never-unlockable`.
- [ ] `trait-requirement-row-never-holds` (warning): the two Q14 shapes, per bearer.
- [ ] `trait-requirement-never-unlockable` counts rows and treats Not Conditions as holding (Q15).
- [ ] `trait-requirement-unresolved` reports each unresolved Condition inside a row.
- [ ] `trait-default-gated` reports the later of two defaults that exclude each other (Q16).
- [ ] Each finding names the trait and, where it applies, the row, and takes the author to the trait's Availability tab as today.
- [ ] Tests through `runRules`, per bearer, with a linked trait, for both new rules and the three changed ones. Each guard is shown to bite.
- [ ] Changelog fragment names the two rules.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
