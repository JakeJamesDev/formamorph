# 03: Brush Editor

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An author can paint a mask over a location image in the World Editor. The spec covers this in Q2, Q8 and Q12.

- **Mask document.** A pure module: an ordered list of operations (stroke with size, softness and brush or eraser mode; fill; clear; invert) with undo and redo. A canvas renderer replays it over a base mask. The module holds no canvas. This ticket owns it.
- **Editor.** A modal over the slot's picture, with the mask as an overlay. Tools: brush, eraser, size, soft edge, invert, fill, clear, undo, redo. Save writes a PNG at the image's size, capped like uploads, into the linked Mask entry or a new one; Cancel discards. When the mask is shared, the editor names how many images use it, and Save changes it for all of them.
- **Entry points.** The slot control's Paint (no mask) and Edit (with mask).
- **Dev route and help.** A dev-router route for the editor and a surface registry entry. The wiki location page covers painting.

## Acceptance criteria

- [ ] The mask document's tests cover each operation, soft edge, invert, fill and clear, and undo and redo across them.
- [ ] Paint on a slot with no mask creates and links a new Mask on Save; Cancel creates nothing.
- [ ] Edit on a shared mask names the shared count, and Save changes the mask on every slot that links it.
- [ ] The saved mask has the image's aspect ratio.
- [ ] Frames of the editor with a painted window, both themes: `.scratch/frames/brush-dark.png`, `.scratch/frames/brush-light.png`.

For you: paint a window by hand and judge how the brush and soft edge feel.
