# 07: Unclipped Landing Pulse

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: overlay placement must track scroll and layer correctly over dialogs, and clipping claims need painted proof, not rects.

Parent: [History Reveal Origin spec](../spec.md)

## What to build

The Landing Pulse draws its ring outside its target, so a scroll window cuts it off when the target sits near the window's edge. The first field of a panel loses the ring's top edge after an undo (Q18).

Draw the ring in an overlay layer above the page, placed over the target, so no scroll window or other clipping ancestor can cut it. The look and the motion stay as they are: the same ring, the same outward pulse, the same still ring under reduced motion, the same 1.5 s. The change is in the shared pulse, so history reveal and Take Me There both get it.

## Acceptance criteria

- [ ] A pulse on a field flush with the top or left edge of an editor scroll window shows the whole ring.
- [ ] The ring follows its target if the target scrolls or moves during the pulse.
- [ ] A pulse on a target inside a dialog shows above that dialog.
- [ ] A repeat pulse on the same target restarts it, and a cancel removes the ring at once.
- [ ] Reduced motion draws the still ring.
- [ ] The overlay never takes pointer events or focus.
- [ ] History reveal and Take Me There landings both use the overlay. No caller still draws the ring on the target itself.
- [ ] Clipping is proved by painted truth: a Playwright check samples a point on the ring's top edge for a flush field. The point is absent before the fix and present after it. A bounding rect does not count.
- [ ] The Design System's Landing Pulse reference still renders.
