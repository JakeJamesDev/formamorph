# 05: Routine Tab: Day Strip

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Owns the row selection that tickets 06 and 07 read.

## What to build

A 24-hour strip sits above the routine's sentences. Daypart icons mark the day, each with its full name in a tooltip. Each row is a band in its action's color; an All-day row sits under the timed rows as the base layer; free time is hatched.

- Clicking a band or a sentence selects that row, in both places at once, and scrolls its sentence into view.
- Clicking a hatched gap adds a row that fills it.
- Each timed band has a drag handle on both ends. A daypart row snaps to daypart edges and an hours row snaps to whole hours. A label on the handle shows its position in the row's own format. A drag stops at the last valid spot and never overlaps another timed row.
- On a shared edge the selected row's handle wins. Rows never drag together.
- A press outside the rows, their bands, their handles and their open editors clears the selection.

The prototype's D2 variant is the reference.

Spec rulings: Q67, Q69, Q70. Stories 9–15.

## Acceptance criteria

- [ ] The strip draws every row of the Start on show, with a range that wraps midnight split across both ends.
- [ ] Selecting a band selects its sentence, and the reverse. A press elsewhere clears it; a press inside an open row editor does not.
- [ ] A handle drag changes the row's stored time, snaps by the row's format, shows its label, and stops before another timed row. A component test drives a drag into a neighbor and asserts the row stops at its edge.
- [ ] With two rows sharing an edge, a drag there moves only the selected row.
- [ ] A click on a gap adds one row that covers exactly that gap.
- [ ] Each drag is one undo step.
- [ ] Handles are reachable by keyboard and name their value.
- [ ] Frames: `.scratch/frames/routine-strip.png` and `.scratch/frames/routine-strip-selected.png`, light and dark, at 1440 px and at 390 px wide.

For you: the drag feel of the handles, on a routine with three or more rows.
