# 07: Canvas Routine Editing

Status: ready-for-agent
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

- [ ] Each click rule above changes the row as described and is one undo step. Tests cover Stay, Wander add and remove, Patrol add, Patrol remove-last, and the first place of an empty row.
- [ ] A click on a place that is not connected to the Start changes nothing.
- [ ] A drag from a Patrol stop inserts the target right after it. A drag from the last stop to stop 1 is refused. A drag from a place outside the row cannot start.
- [ ] A drag onto a place that is not connected, or a Wander drag onto a place already in the set, shows as refused during the drag.
- [ ] A real pointer drag adds a place for a Wander row and for a Patrol row. Playwright drives it, since a synthetic event does not start a canvas drag.
- [ ] With no row selected, a click toggles a listed Traversable place, and does nothing under Anywhere.
- [ ] The status line changes with the selection and names the action and its time.
- [ ] The status line's copy follows the Writing Guide.
- [ ] Frames: `.scratch/frames/canvas-routine-edit-patrol.png` and `.scratch/frames/canvas-routine-status.png`, light and dark, at 1440 px wide.

For you: whether dragging stop to stop feels like drawing Connections, and whether a click that does nothing under Anywhere needs more than the status line.
