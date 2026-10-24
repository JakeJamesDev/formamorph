# 11: Map Background Canvas Fixes

Status: ready-for-agent
Blocked by: 10
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Two fixes to ticket 10's canvas work: the card reuses the existing gallery widget, and the Adjust layer order changes inside React Flow. The layer change touches pointer routing on the canvas, so Opus.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

The user's review of ticket 10 (Q82, Q83).

- **Gallery on the canvas card (Q82):** the card that **Set Background Image…** and **Replace Background Image…** open shows the Map Background gallery widget, the one the Media tab's image panel uses, in place of the bare upload box. Its tiles reorder by drag, each tile has the remove x, and the add tile uploads. Removing the last image clears the frame and opacity (Q77). With an empty gallery, a first upload lands at the canvas default placement (Q78). The menu labels stay as Q76 rules.
- **Boxes above the map while adjusting (Q83):** with Adjust on, location boxes, group boxes and arrows draw above the map image, as they do when locked. They take no pointer while Adjust is on, so a press anywhere on the image, under a box included, starts a move. The corner handles and the image outline draw above the boxes, so every handle stays reachable. Leaving Adjust restores box drag, selection and connections.

Update the Locations page's canvas section. Changelog: fold into ticket 10's Map Background line, which is unreleased.

## Acceptance criteria

- [ ] The Set/Replace card shows the current map images as gallery tiles; the x on a tile removes that image, one undo step
- [ ] Removing the last image from the card clears the frame and opacity; the next upload lands at the canvas default placement
- [ ] Tiles reorder by drag from the card, and the canvas shows the new slot 0
- [ ] With Adjust on, boxes and arrows render above the map image (e2e reads the stacking)
- [ ] With Adjust on, a press on the image under a box moves the image and does not move or select the box
- [ ] With Adjust on, each corner handle resizes even when a box covers it
- [ ] With Adjust off, box drag, marquee selection and drawing a Connection work over the image
- [ ] Frame: `.scratch/frames/map-background-adjust-boxes-dark.png` at 1600×900, Adjust on with a box over the image

For you: open the canvas card, remove an image with its x, then adjust the map with boxes on top.
