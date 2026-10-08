# 07: Default-gated reads the link's rows

Status: ready-for-human
Blocked by: none
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: one Test Bench rule reads the wrong gate for a linked trait; small fix on the pure `runRules` seam with a guard that bites.

Parent: [Trait Gate Rows spec](../spec.md)

## What to build

When a link overrides a trait's rows, `trait-default-gated` still quotes the world trait's rows and opens the world trait. The finding must read the link's rows for that bearer, print them in the gate-line form (Q35), name the entity, and open the link, the way `trait-requirement-unresolved` and `trait-requirement-row-never-holds` do (Q33, Q34). The gap predates rows; ticket 04 found it and left it out of scope.

## Acceptance criteria

- [ ] For a linked trait whose link overrides `requires`, `trait-default-gated` evaluates the link's rows against that bearer's defaults.
- [ ] The message quotes the link's rows and names the entity; the finding opens the link.
- [ ] A linked trait with no override still reads the original's rows and opens the original.
- [ ] Tests through `runRules`: the override case and the no-override case. The override guard is shown to bite by reinstating the bug.
- [ ] Changelog fragment in `docs-internal/changelog.d/` names the fix under Fixed.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
