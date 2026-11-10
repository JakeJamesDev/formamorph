# 06: Canvas Routine View

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

On the full-screen location canvas, the entity card in the right panel holds the same Routine editor as the entity panel. Nothing floats beside it. The card's mode switch is Routine / Known In, and Known In keeps today's picker.

In Routine mode the map shows the routine of the Start on show. Connection lines, their labels and the starting-location star hide. Changing the Start tab redraws the map.

- **No row selected (overview):** every routine place wears the same neutral ring, a flag marks where the Start begins, each move at a set time is an arrow in its action's color with the time as its label, and each Patrol move is an arrow. No badges and no Wander lines.
- **A row selected (detail):** only that row's lines draw. Its places take its action color and its badges: Wander chances or Patrol stop numbers. Wander places are joined by lines without arrowheads. The other routine places keep the neutral ring.
- **Reach:** a listed Traversable place wears a dashed outline. With Traversable = Anywhere, reachable places stay plain. Places the entity can never reach are faded.
- **A Group:** its places are highlighted and no lines draw.

A press on the map keeps the row selection, so the author can pan with a row selected.

The prototype's canvas view is the reference. Two findings from it apply: the old picker's rule that draws canvas lines at 25% must not apply in Routine mode, and movement lines run straight between places.

Ticket 05 left two things to use: the shared selection store (the Start on show and the selected row, per entity), which this ticket only reads, and the three approved action-color tokens for the map's lines and marks. A press on the map must count as "inside" for the store's click-away rule (Q80).

Spec rulings: Q71–Q74, Q80, Q113.

## Acceptance criteria

- [ ] The canvas card renders the Routine editor inside the right panel, and the panel scrolls when the editor is taller than the window.
- [ ] In Routine mode no Connection line, Connection label or starting-location star is on the map, and they return in Known In mode and when the entity is closed.
- [ ] The overview and the detail draw as described, for a Start with a Stay row, a Wander row and a Patrol row. A test reads the marks and the lines in both states.
- [ ] A Patrol that goes A, B, A draws both directions as separate arrows.
- [ ] Movement lines draw at full strength.
- [ ] Faded, outlined and plain places follow the reach rules above, for a listed Traversable and for Anywhere.
- [ ] A press or a pan on the map keeps the selected row.
- [ ] The dev-router's canvas pick route opens this view.
- [ ] The card's copy follows the Writing Guide.
- [ ] Frames: `.scratch/frames/canvas-routine-overview.png` and `.scratch/frames/canvas-routine-detail.png`, light and dark, at 1440 px wide.

For you: whether the overview reads at a glance on a world with twelve or more locations, and the mark colors against a Map Background image.
