# 04: Routine Tab: Starts and Rows

Status: ready-for-human
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

- [x] The Routine tab is in the entity panel for world entities and has a dev-router entry. `useWorldEntitiesAdapter.panelTabs.test.tsx`, `devRouter.test.ts` (`worldEditorEntity.routine`).
- [x] Adding, editing and deleting Starts and rows writes the world, and each edit is one undo step. `RoutineTab.test.tsx`: adds a row as one undo step, keeps two quick picks as two undo steps, deletes a row as one undo step; picks run as labeled History Steps, typing joins the typing run.
- [x] A time pick that would overlap another timed row is disabled, and the add buttons disable when timed rows fill the day. A component test covers both. `RoutineTab.test.tsx`: disables a daypart another timed row holds; refuses typed hours that overlap and greys out those hours; closes the add buttons when timed rows fill the day.
- [x] The swap to hours and back keeps the stored minutes, and snaps with a note when the hours miss daypart edges. `RoutineTab.test.tsx`: swaps to hours and back; snaps odd hours and says so.
- [x] The free-time line names the uncovered hours, reads "Busy all day" with none, and an All-day row reads "The rest of the day" next to timed rows. `RoutineTab.test.tsx`, the "routine as sentences" block.
- [x] Place pickers list only connected places. A row place that a link edit disconnects stays, shows a flag, and returns to normal when the edit is undone. `RoutineTab.test.tsx`: lists only connected locations; flags a location a link removal disconnects and clears it on undo.
- [x] The Wander and Patrol list reorders by drag, and the order is what Patrol walks. `RoutineTab.test.tsx`: reorders Patrol stops by keyboard drag; the stored `stops` order is what the engine walks.
- [x] The themed time field takes a time of day alone, and its existing date and date-time uses are unchanged. `date-time-field.test.tsx`: the time-only block, beside the unchanged existing suite.
- [x] Every label, hint and tooltip is written under the Writing Guide from a facts list, not from the spec's working names. Copy uses location, start, lock and Can Also Go; hints are 12 words or fewer; the standards review checked it.
- [x] The Design System showcase lists any new pattern this adds. Routine Sentences: `RoutineSentenceReference.tsx` and the Design-System page.
- [x] Frames: `.scratch/frames/routine-tab.png` and `.scratch/frames/routine-row-editor.png`, light and dark, at 1440 px and at 390 px wide. Each PNG holds four frames: 1440 light and dark stacked, 390 light and dark beside them.

For you: the editor's wording and feel on a real character, and whether the weight field in the Wander list reads as clearly as the chips did.

## Landed

**Rulings this ticket added:** Q109 (the idle control is a number plus a unit), Q110 (disabled hours plus a refused overlapping write), Q111 (the stand-in leaves Profile; the tour step moves; the last Start stays).

**Not verified**

- None of the acceptance lines. The frames come from the Browser pane, which captures at reduced size.

**For you**

- For you: the editor's wording and feel on a real character, and whether the weight field in the Wander list reads as clearly as the chips did.
- Frames: `.scratch/npc-schedules-04/frames/routine-tab.png` and `.scratch/npc-schedules-04/frames/routine-row-editor.png`.
- With an All-day row, the list reads *The rest of the day, …* and then *Busy all day.* (Q68 read literally). Check that the pair doesn't read as a contradiction.
- The sentence shows hours on a 24-hour clock (*07:55 – 17:02*); the time field follows your locale, which may be 12-hour.
- Wander lists each location once. Patrol may repeat stops.
- The lock icon is the Strict control; its tooltip reads *Locked: can't be called over or follow the player*.
- A custom persona's Routine tab holds only its **Locations**, as the Profile tab did before.

