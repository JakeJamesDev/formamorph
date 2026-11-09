# 04: Routine Tab: Starts and Rows

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Owns the Routine editor component that tickets 05, 06 and 11 reuse or open.

## What to build

The entity panel gets a Routine tab that replaces ticket 03's stand-in control. An author switches a character between Group and Individual. A Group edits its place list. An Individual edits:

- **Starts:** a tab per Start, with its place and its weight. With several Starts each tab shows its chance. Starts can be added and deleted.
- **The routine as sentences**, in clock order: "Morning – Afternoon, stays at the Smithy." Each part of a sentence opens its own editor: the time, the action, the places.
- **Free time inline:** a line names the hours no row covers and where the character stays then. With no free hours it reads "Busy all day". An All-day row reads "The rest of the day" next to timed rows.
- **Time:** dayparts by default, with a swap button to hours. Hours use the themed time field. Swapping odd hours back snaps to the covering dayparts and says so. Timed rows can't overlap: a pick that touches another timed row is disabled, and add buttons disable when the day is full.
- **Places:** Stay picks one place. Wander and Patrol share one list control: drag to reorder, the place, the action's field on the right (weight and its percent for Wander, idle for Patrol), then remove. Patrol rows are numbered. Wander has one idle field under the list. Pickers list only places connected to the Start. A stored place that is no longer connected stays in its row with a flag.
- **Strict** per row, and **Traversable** per entity: Anywhere, or a list of exact places.

The prototype's D2 variant is the reference for layout and behavior. Read it on branch `prototype/npc-schedules`; do not copy its in-memory store.

Spec rulings: Q5, Q9, Q32, Q34, Q35, Q44, Q50, Q54, Q59, Q60, Q65–Q68, Q78, Q79. Stories 1–7, 9–25.

## Acceptance criteria

- [ ] The Routine tab is in the entity panel for world entities and has a dev-router entry.
- [ ] Adding, editing and deleting Starts and rows writes the world, and each edit is one undo step.
- [ ] A time pick that would overlap another timed row is disabled, and the add buttons disable when timed rows fill the day. A component test covers both.
- [ ] The swap to hours and back keeps the stored minutes, and snaps with a note when the hours miss daypart edges.
- [ ] The free-time line names the uncovered hours, reads "Busy all day" with none, and an All-day row reads "The rest of the day" next to timed rows.
- [ ] Place pickers list only connected places. A row place that a link edit disconnects stays, shows a flag, and returns to normal when the edit is undone.
- [ ] The Wander and Patrol list reorders by drag, and the order is what Patrol walks.
- [ ] The themed time field takes a time of day alone, and its existing date and date-time uses are unchanged.
- [ ] Every label, hint and tooltip is written under the Writing Guide from a facts list, not from the spec's working names.
- [ ] The Design System showcase lists any new pattern this adds.
- [ ] Frames: `.scratch/frames/routine-tab.png` and `.scratch/frames/routine-row-editor.png`, light and dark, at 1440 px and at 390 px wide.

For you: the editor's wording and feel on a real character, and whether the weight field in the Wander list reads as clearly as the chips did.
