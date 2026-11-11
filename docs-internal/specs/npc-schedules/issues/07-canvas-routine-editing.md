# 07: Canvas Routine Editing

Status: done
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

With a row selected, the author edits it on the map.

- **Click:** a Stay row moves to the place. A Wander row adds the place or removes it. A Patrol row adds it as the next stop, and a click on the last stop removes that stop. An empty row takes its first place from one click. Only places connected to the Start take a click.
- **Drag:** the places of a selected Wander or Patrol row show their connect grip without a hover, and a drag starts only there. It ends on any connected place; other places refuse the drop while the drag is in flight. Patrol puts the new stop right after the stop the drag left, after its last occurrence when the place repeats. A drag from the last stop back to stop 1 does nothing. Wander adds the target. A Stay row has no drag.
- A Patrol may visit the same place more than once.

With no row selected, a click adds the place to the Traversable list or removes it. With Traversable = Anywhere a click does nothing.

A status line at the top of the map says what a click or a drag does right now, for the selected row's action and time, and for the no-row case.

The prototype is the reference. One finding from it applies: a tooltip that appears on a connect grip at runtime remounts the grip, the canvas loses its measured position, and the drag never starts. Routine grips carry no tooltip; the status line says what they do.

Spec rulings: Q75–Q77.

## Acceptance criteria

- [x] Each click rule above changes the row as described and is one undo step. Tests cover Stay, Wander add and remove, Patrol add, Patrol remove-last, and the first place of an empty row. (`routineMapEditing.test.ts` "a click with a row selected"; one Step proven in `e2e/canvas-routine-edit.spec.ts` by Undo emptying the history after a drag)
- [x] A click on a place that is not connected to the Start changes nothing. ("changes nothing on a place not connected to the Start", mutation-checked)
- [x] A drag from a Patrol stop inserts the target right after it. A drag from the last stop to stop 1 is refused. A drag from a place outside the row cannot start. (unit "a drag" block; the grip shows only on the row's places, e2e)
- [x] A drag onto a place that is not connected, or a Wander drag onto a place already in the set, shows as refused during the drag. (e2e reads the drop handle's `valid` class mid-drag; mutation-checked)
- [x] A real pointer drag adds a place for a Wander row and for a Patrol row. Playwright drives it, since a synthetic event does not start a canvas drag. (`e2e/canvas-routine-edit.spec.ts`, desktop)
- [x] With no row selected, a click toggles a listed Traversable place, and does nothing under Anywhere. (unit "a click with no row selected")
- [x] The status line changes with the selection and names the action and its time. (unit "the status line"; frames)
- [x] The status line's copy follows the Writing Guide. (period rule; quoted labels in a plain-text slot; reviewed)
- [x] Frames: `.scratch/frames/canvas-routine-edit-patrol.png` and `.scratch/frames/canvas-routine-status.png`, light and dark, at 1440 px wide. (stored with `-light` / `-dark` suffixes)

For you: whether dragging stop to stop feels like drawing Connections, and whether a click that does nothing under Anywhere needs more than the status line.

## Landed

Spec-session rulings for this ticket: the status line shows for a Group; no Patrol stop follows its own place, for a drag or a click, with the loop from the last stop to stop 1 counted; a no-row click toggles any place, connected or not; a click may empty a Wander or Patrol row.

**Not verified**
- Nothing open. The mobile Playwright project skips the drag tests: a grip drag is a mouse gesture.

**For you**
- Whether dragging stop to stop feels like drawing Connections, and whether a click that does nothing under Anywhere needs more than the status line. Look at `.scratch/npc-schedules-07/frames/canvas-routine-edit-patrol-light.png` and `.scratch/npc-schedules-07/frames/canvas-routine-status-light.png` (and `-dark`).
- Undo of a map edit closes the full-screen canvas and opens the entity's Profile tab (the editor's Reveal Origin). Decide if a map edit should undo in place.
