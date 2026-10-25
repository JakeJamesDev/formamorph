# 11: Map Background Canvas Fixes

Status: done
Blocked by: 10
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Two fixes to ticket 10's canvas work: the card reuses the existing gallery widget, and the Adjust layer order changes inside React Flow. The layer change touches pointer routing on the canvas, so Opus.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

The user's review of ticket 10 (Q82, Q83).

- **Gallery on the canvas card (Q82):** the card that **Set Background Image…** and **Replace Background Image…** open shows the Map Background gallery widget, the one the Media tab's image panel uses, in place of the bare upload box. Its tiles reorder by drag, a tile press frames an image, the x removes the framed image, and the add tile uploads. Removing the last image clears the frame and opacity (Q77). With an empty gallery, a first upload lands at the canvas default placement (Q78). The menu labels stay as Q76 rules.
- **Boxes above the map while adjusting (Q83):** with Adjust on, location boxes, group boxes and arrows draw above the map image, as they do when locked. They take no pointer while Adjust is on, so a press anywhere on the image, under a box included, starts a move. The corner handles and the image outline draw above the boxes, so every handle stays reachable. Leaving Adjust restores box drag, selection and connections.

Update the Locations page's canvas section. Changelog: fold into ticket 10's Map Background line, which is unreleased.

## Acceptance criteria

- [x] The Set/Replace card shows the current map images as gallery tiles; a tile press frames an image, and the x removes the framed image, one undo step (e2e "the Replace card is the gallery": the x after a reorder, then one Undo brings back the reordered pair)
- [x] Removing the last image from the card clears the frame and opacity; the next upload lands at the canvas default placement (same e2e: the layer leaves, the upload covers the locations at opacity 1, in Adjust)
- [x] Tiles reorder by drag from the card, and the canvas shows the new slot 0 (same e2e: pointer drag, the canvas `img` src is the old Image 2)
- [x] With Adjust on, boxes and arrows render above the map image (e2e "Adjust draws the boxes…": computed z-index -1 for the map, ≥0 for a node, `auto`/0 for the arrow's svg, 2000 for the handles)
- [x] With Adjust on, a press on the image under a box moves the image and does not move or select the box (same e2e: press on Marsh; keys too: ArrowRight and Ctrl+A move and select nothing)
- [x] With Adjust on, each corner handle resizes even when a box covers it (same e2e: `elementFromPoint` at the nw corner under Harbor is the handle, and it resizes)
- [x] With Adjust off, box drag, marquee selection and drawing a Connection work over the image (same e2e, after Stop Adjusting)
- [x] Frame: `.scratch/frames/map-background-adjust-boxes-dark.png` at 1600×900, Adjust on with a box over the image (written by the e2e)

For you: open the canvas card, remove an image with its x, then adjust the map with boxes on top.

## Landed

**Not verified**
- Mobile: the map-background e2e spec skips the mobile project, as ticket 10's did (mouse gestures).

**For you**
- Open the canvas card, remove an image with its x, then adjust the map with boxes on top. Frame: `.scratch/media-tab-11/frames/map-background-adjust-boxes-dark.png`.
- Each card change is its own undo step, with new labels: Add Image N, Reorder Images, Replace Image N, Edit Map Background. Check them in the History menu.
- The Media tab's gallery still writes without a label, so a quick reorder then removal there merges into one undo step. This is unchanged from ticket 10.
