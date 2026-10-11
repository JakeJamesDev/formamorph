# 09: Stat Groups in the Editor and Panel

Status: done
Blocked by: 03, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Rationale: brings the trait tree's grouping to stats with the trait tree as prior art; the drag invariants (ADR-0007) are the trap.

Parent: [Entity Stats spec](../spec.md)

## What to build

Authors group stats, on the Stats tab and inside each entity's Stats tab. Groups nest, reorder and carry a description, as trait groups do. They are for organization only. In game, the stat panel shows groups as collapsible headings for the player's stats and the selected entity's stats, and a group with nothing visible doesn't show. Rulings Q21, Q25, Q27.

## Acceptance criteria

- [ ] The Stats tab and the entity Stats tab show a tree with author groups: add, rename, describe, nest, reorder and delete.
- [ ] Stat groups have no modes, pick counts or gates.
- [ ] The in-game stat panel shows groups as collapsible headings; a group with no visible stat is left out.
- [ ] World migration fills worlds with no stat groups; export and import round-trip them.
- [ ] Undo, redo and History record group edits.
- [ ] Response carries the export-shape reminder.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
