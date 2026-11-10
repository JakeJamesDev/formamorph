# 15: Canvas Routine View For Groups

Status: ready-for-agent
Blocked by: 13
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

On the full-screen Locations canvas, a Group reads and edits like an Individual, for the Start on show.

- With no row selected, the canvas shows that Start's routine: action colors, day bars, Patrol arrows, the "Starts Here" flag.
- The places where the Group's other Starts begin take the "Is Here" mark. The key lists that entry when it is drawn.
- With a row selected, a click or a drag edits that row, by the same rules as an Individual.
- With no row selected, a click on a place adds a Start with no rows there, or removes the Starts that begin there, through ticket 13's helper. The status line says so.
- No Traversable marks draw for a Group, and a click never edits Traversable.

The right panel uses the Routine tab's controls. If ticket 14 has not landed, the panel shows ticket 13's stand-in; do not build Group controls here.

Spec rulings: Q138, Q136, Q126–Q129.

## Acceptance criteria

- [ ] The canvas view model gives a Group the spans, tones and Patrol lines of the Start on show, and marks the other Starts' places. View-model tests cover a Group with two Starts.
- [ ] A selected row of a Group takes map clicks and drags, with the same results as the Individual tests.
- [ ] With no row selected, a click adds or removes a Start, the last Start stays, and the status line states what a click does.
- [ ] The key shows "Is Here" for a Group with more than one Start and no "Can Also Go" entry.
- [ ] Frames of a Group with two Starts, no row selected: `.scratch/frames/canvas-group-light.png` and `.scratch/frames/canvas-group-dark.png` at 1600×900.
- [ ] `docs/World-Editor-Entities.md` or the Locations page describes the canvas for a Group.
