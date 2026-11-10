# 14: Routine Tab For Groups

Status: ready-for-agent
Blocked by: 13
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A Group gets the Routine tab an Individual has: a tab per Start, the "begins at" sentence, rows with Stay, Wander and Patrol, and the day strip. The stand-in place control from ticket 13 goes away.

What differs for a Group:

- A Start shows no chance chip, and its weight can't be edited. The weight stays in the data.
- Rows show no Strict lock, and free time shows no lock.
- Traversable is not shown.
- The text that explains the Starts says every Start runs at the same time. Read `docs/Writing-Guide.md` ("Before you write") first and write it from a facts list.

A kind switch keeps every Start and row in both directions. Switching back to Individual shows the hidden values again, unchanged.

Use ticket 13's helper to add and remove a Group's Starts.

Spec rulings: Q134, Q135, Q136, Q137, Q111.

## Acceptance criteria

- [ ] A Group's Routine tab shows Start tabs, rows and the day strip, and every row edit an Individual has works on a Group's Start.
- [ ] For a Group, no chance chip, weight field, Strict lock or Traversable control renders. Component tests cover each.
- [ ] Switching Individual → Group → Individual leaves the Starts, rows, weights, Strict flags and Traversable list equal to the original.
- [ ] The last Start of a Group can't be deleted.
- [ ] The stand-in place control is removed.
- [ ] `verify-ui` on the dev route with a Group that has two Starts: frames `.scratch/frames/routine-group-light.png` and `.scratch/frames/routine-group-dark.png` at 1600×900.
- [ ] `docs/World-Editor-Entities.md` describes a Group's routine. One changelog entry under the Routine Tab group.

For you: read the Group wording in the Routine tab of an entity set to Group.
