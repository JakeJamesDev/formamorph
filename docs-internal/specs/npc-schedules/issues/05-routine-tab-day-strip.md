# 05: Routine Tab: Day Strip

Status: ready-for-human
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

- [x] The strip draws every row of the Start on show, with a range that wraps midnight split across both ends. (`DayStrip.test.tsx` "draws each row of the Start on show…")
- [x] Selecting a band selects its sentence, and the reverse. A press elsewhere clears it; a press inside an open row editor does not. ("selects the sentence from its band…", "keeps the selection through a press in the row's open editor…")
- [x] A handle drag changes the row's stored time, snaps by the row's format, shows its label, and stops before another timed row. A component test drives a drag into a neighbor and asserts the row stops at its edge. ("stops at a neighbor's edge…", "…even when the pointer jumps past it", "snaps an hours row to whole hours…")
- [x] With two rows sharing an edge, a drag there moves only the selected row. ("moves only the selected row on a shared edge"; the selected handle is on top)
- [x] A click on a gap adds one row that covers exactly that gap. ("adds one Stay … over exactly that gap", a gap that wraps midnight)
- [x] Each drag is one undo step. ("makes each drag one undo step", with pauses past the typing-run window)
- [x] Handles are reachable by keyboard and name their value. ("moves by keyboard one snap at a time…", `role=slider` with `aria-valuetext`)
- [x] Frames: `.scratch/frames/routine-strip.png` and `.scratch/frames/routine-strip-selected.png`, light and dark, at 1440 px and at 390 px wide. (Playwright element shots, one file per theme and width)

For you: the drag feel of the handles, on a routine with three or more rows.

## Landed

**Rulings this ticket added:** Q113 (action-color tokens, sentence swatch, gap fill selects a Stay, shared selection store, keyboard handles), Q116 (handles never cross their own row's other end). The user approved the three action colors as built.

**Not verified**

- None. Drag feel with a real pointer is the user's check below.

**For you**

- For you: the drag feel of the handles, on a routine with three or more rows.
- Frames: `.scratch/npc-schedules-05/frames/routine-strip-light-1440.png`, `routine-strip-dark-1440.png`, `routine-strip-light-390.png`, `routine-strip-dark-390.png`, and the four `routine-strip-selected-*` twins (Patrol row selected, its shared handle hovered).
- Clicking free time on an empty routine adds an **All Day** Stay, since a timed row can never cover the whole day.
- A drag can't turn a row into one that wraps midnight (Q116); the time picker still can.
- A press in any open popover or select on the page keeps the selection, as in the prototype.
- Ticket 06 reads `useRoutineSelection` from `src/lib/routineSelection.ts`. A row's hours/dayparts choice stays local to the tab.
