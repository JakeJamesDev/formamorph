# 14: Routine Tab For Groups

Status: ready-for-human
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

- [x] A Group's Routine tab shows Start tabs, rows and the day strip, and every row edit an Individual has works on a Group's Start. (RoutineTab tests "shows Start tabs…" and "edits a row of the shown start"; the rows share the Individual's `StartRoutine`.)
- [x] For a Group, no chance chip, weight field, Strict lock or Traversable control renders. Component tests cover each. (Three "a Group's routine" tests, including the strip's lock mark; each guard mutation-tested red.)
- [x] Switching Individual → Group → Individual leaves the Starts, rows, weights, Strict flags and Traversable list equal to the original. (UI round-trip test "keeps every Start, row, weight, lock and Can Also Go…", plus the entityKind test.)
- [x] The last Start of a Group can't be deleted. (Delete test; `withoutGroupStart` unit test.)
- [x] The stand-in place control is removed. (`GroupStarts` deleted; its tests replaced.)
- [x] `verify-ui` on the dev route with a Group that has two Starts: frames `.scratch/frames/routine-group-light.png` and `.scratch/frames/routine-group-dark.png` at 1600×900. (Lantern Moths in `fixture=entityPresence`, captured with headless Playwright.)
- [x] `docs/World-Editor-Entities.md` describes a Group's routine. One changelog entry under the Routine Tab group.

For you: read the Group wording in the Routine tab of an entity set to Group.

## Landed

**Not verified**

- Nothing left unticked.

**For you**

- For you: read the Group wording in the Routine tab of an entity set to Group. Frames: `.scratch/npc-schedules-14/frames/routine-group-light.png` and `.scratch/npc-schedules-14/frames/routine-group-dark.png`.
- The switch reads Unique and Generic (Q162–Q164). Hints: Unique "Places one character at one of the starts below"; Generic "Places one of this type of character at every start below"; under a Generic entity's Start tabs, "Runs every start at the same time, each on its own routine".
- "Unique" also names a placeholder chip mode (World or Unique) in `docs/Glossary.md`. Check that the two meanings don't confuse authors.
- `docs/World-Editor-Locations.md` lines 214–216 still say Every Location and One Location; ticket 16 owns that paragraph. Line 245 already says Unique and Generic.
- The Glossary and Scripts Reference rows also moved to Unique and Generic.
