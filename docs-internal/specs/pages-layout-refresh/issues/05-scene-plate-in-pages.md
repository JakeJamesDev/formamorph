# 05: Scene Plate in Pages

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: a new shared component plus a handler contract change that runs from the panel up through the game view.

## What to build

A new **Scene Plate** component shows one turn's scene images at the top of the Pages card, above the action
line. The newest image is in view. A click zooms it. An overlay with previous, count, next, and delete shows
on hover and on focus within. A turn with no image shows no plate.

The plate sizes its box from the image header before the image loads, as Chat's inline image does today, so
the text below does not move.

Delete takes the turn, not only the viewed page. The delete handler's contract changes from "index on the
viewed turn" to "turn id and index". This changes no save or world shape.

The scene panel under the narration loses its image, its browse arrows, and its delete button. It keeps the
job status, the live preview during a draw, and the tag row with its three buttons. It shows when the turn
has an image, a job, or a tag line, so the player can fix tags by hand and draw again when an image exists.

Shares the narration panel file with 03 and 04; run them one at a time. Prototype traps: its plate does not
size its box before load, and it reassigns a parameter in the scene panel.

## Acceptance criteria

- [ ] Plate at the top of the card when the turn has an image; nothing when it has none
- [ ] Click zooms; arrows and the count show only with more than one image
- [ ] Delete removes the image in view, by turn id and index
- [ ] Overlay controls show on hover and on keyboard focus
- [ ] The box is sized before the image loads
- [ ] The scene panel shows no image; the tag row shows in every state where the turn has an image, a job, or tags
- [ ] Draw progress and the live preview show as before
- [ ] Paging to another turn resets the plate's index
- [ ] Harness tests: plate absent and present, delete, tag row present with an image
- [ ] Verified in the preview with a real drawn image, both themes
- [ ] Four gates green
