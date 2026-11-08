# 04: Feature Tour

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A feature tour replaces the onion-skin light/dark gallery and its thumbnail strip. Six steps (Play, Inventory, Library, Create, Your setup, Avatars) scroll past one pinned screenshot that switches to the current step. Each screenshot carries hotspots whose notes show on hover and on keyboard focus.

On five-palette steps, the next palette sweeps across every few seconds while the frame is visible and not hovered. Dragging previews it, and releasing past the middle keeps it. Swatches pick one directly. The Inventory step shows the full Inventory frame from ticket 02 with its wipe and swatches off.

Three cards for browser, desktop and Android close the page above the footer. Tour frames load lazily.

The prototype (`.scratch/landing-v2/index.html`, untracked) is the reference build. Copy for the steps, hotspots and cards is written per the Writing Guide.

## Acceptance criteria

- [ ] Scrolling each step to the middle of the viewport sets its screenshot; the Inventory step is second.
- [ ] Every hotspot is reachable with Tab and shows its note on focus.
- [ ] Dragging the wipe past the middle and releasing switches the palette; releasing before it restores the current one; swatches set the palette.
- [ ] The automatic sweep stops under reduced motion and on the Inventory step.
- [ ] Tour frames below the fold are not requested until the tour nears the viewport.
- [ ] The onion-skin gallery, its slideshow and its thumbnail strip are gone; the landing suite's old gallery tests are replaced by tour tests.
- [ ] At 375 wide the screenshot pins above the step text and the page has no horizontal scroll.
- [ ] Frames: `.scratch/frames/tour-inventory-dark-1440.png`, `.scratch/frames/tour-play-light-1440.png`, `.scratch/frames/tour-mid-wipe-dark-1440.png` and `.scratch/frames/tour-dark-375.png`.

For you: the sweep's rhythm and the hotspot notes' wording on each step.
