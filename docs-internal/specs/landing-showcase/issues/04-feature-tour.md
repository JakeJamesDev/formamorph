# 04: Feature Tour

Status: done
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A feature tour replaces the onion-skin light/dark gallery and its thumbnail strip. Six steps (Play, Inventory, Library, Create, Your setup, Avatars) scroll past one pinned screenshot that switches to the current step. Each screenshot carries hotspots whose notes show on hover and on keyboard focus.

On five-palette steps, the next palette sweeps across every few seconds while the frame is visible and not hovered. Dragging previews it, and releasing past the middle keeps it. Swatches pick one directly. The Inventory step shows the full Inventory frame from ticket 02 with its wipe and swatches off.

Three cards for browser, desktop and Android close the page above the footer. Tour frames load lazily.

The prototype (`.scratch/landing-v2/index.html`, untracked) is the reference build. Copy for the steps, hotspots and cards is written per the Writing Guide.

## Acceptance criteria

- [x] Scrolling each step to the middle of the viewport sets its screenshot; the Inventory step is second. (`landing feature tour › scrolling each step to the middle sets its screenshot, Inventory second`, both projects)
- [x] Every hotspot is reachable with Tab and shows its note on focus. (`every hotspot is reachable with Tab…`, all six steps; tap and hover tests too)
- [x] Dragging the wipe past the middle and releasing switches the palette; releasing before it restores the current one; swatches set the palette. (`a drag past the middle keeps the next palette…`; `a swatch picked mid-sweep wins…`)
- [x] The automatic sweep stops under reduced motion and on the Inventory step. (`reduced motion stops the sweep…`; `the sweep paints… and not on the Inventory step`, per-frame clip samples)
- [x] Tour frames below the fold are not requested until the tour nears the viewport. (`tour frames are not requested until the tour nears the viewport`, both projects)
- [x] The onion-skin gallery, its slideshow and its thumbnail strip are gone; the landing suite's old gallery tests are replaced by tour tests. (diff; thumbnails and their capture write removed per Q10)
- [x] At 375 wide the screenshot pins above the step text and the page has no horizontal scroll. (`at 375 wide the screenshot pins above the step text`; `the page fits its viewport`)
- [x] Frames: `.scratch/frames/tour-inventory-dark-1440.png`, `.scratch/frames/tour-play-light-1440.png`, `.scratch/frames/tour-mid-wipe-dark-1440.png` and `.scratch/frames/tour-dark-375.png`. (written by Playwright against the served page)

Each tour behavior test was proven to bite: nine mutants of `hosting/site/tour.js` each turned a test red.

## Landed

**Not verified**

- None.

**For you**

- For you: the sweep's rhythm and the hotspot notes' wording on each step.
- Hotspot placement on the Inventory step: `.scratch/landing-showcase-04/frames/tour-inventory-dark-1440.png`. The positions came from the prototype's capture.
- The step, card and tooltip copy, in a real browser at formamorph.ai's home page.
