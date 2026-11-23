# 03: Brush Editor

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An author can paint a mask over a location image in the World Editor. The spec covers this in Q2, Q8 and Q12.

- **Mask document.** A pure module: an ordered list of operations (stroke with size, softness and brush or eraser mode; fill; clear; invert) with undo and redo. A canvas renderer replays it over a base mask. The module holds no canvas. This ticket owns it.
- **Editor.** The "in the scene" layout of Q19: the slot's picture fills the window as in play, the mask shows as a tint with Show or Hide Mask, a floating toolbar holds the tools and sliders, and Save and Cancel sit top right. On desktop every control group rests faded and returns on hover or keyboard focus. On mobile the controls stay solid: Cancel and Save above the picture, every other control in one panel below. On both, every control hides while a stroke is in progress. Start from variant B on `prototype/weather-mask-brush` (commit f9d6ec4e2); rewrite it, never copy it in. Ticket 04 adds the weather drawing and the preview card. Tools: brush, eraser, size, soft edge, invert, fill, clear, undo, redo. Save writes a PNG at the image's size, capped like uploads, into the linked Mask entry or a new one; Cancel discards. When the mask is shared, the editor names how many images use it, and Save changes it for all of them.
- **Entry points.** The slot control's Paint (no mask) and Edit (with mask).
- **Dev route and help.** A dev-router route for the editor and a surface registry entry. The wiki location page covers painting.

## Acceptance criteria

- [x] The mask document's tests cover each operation, soft edge, invert, fill and clear, and undo and redo across them. `maskDocument.test.ts`, 19 cases; the max-coverage guard proved by mutation.
- [x] Paint on a slot with no mask creates and links a new Mask on Save; Cancel creates nothing. `WeatherMaskControl.test.tsx`: "Paint on a slot with no mask…", "Cancel with nothing painted…", "Cancel after painting asks first…".
- [x] Edit on a shared mask names the shared count, and Save changes the mask on every slot that links it. "Edit on a shared mask names the count…"; guard proved by mutation.
- [x] The saved mask has the image's aspect ratio. "saves at the picture aspect ratio, capped like uploads" (3000 × 4000 saves 1440 × 1920).
- [x] On desktop, control groups read faded with the pointer away and full on hover and on keyboard focus (computed opacity). DOM read at 1280: 0.25 at rest, 1 on hover, 1 on Tab focus, 0.25 after a mouse click.
- [x] Every control hides and takes no input while a stroke is in progress, on desktop and mobile. "every control hides…" and "stacks the controls… hides them there too"; guard proved by mutation.
- [x] A mobile frame at 375 wide shows the stacked layout: `.scratch/frames/brush-mobile-dark.png`.
- [x] Frames of the editor with a painted window, both themes: `.scratch/frames/brush-dark.png`, `.scratch/frames/brush-light.png`.

For you: paint a window by hand and judge how the brush and soft edge feel.

## Landed

**Not verified**

- Paint and Edit from a real World Editor slot in the browser: the White Room fixture's slot is empty, so its control is disabled. The jsdom tests drive the real slot wiring.

**For you**

- For you: paint a window by hand and judge how the brush and soft edge feel. `#dev?modal=weatherMaskEditor` (add `&tab=edit` for a shared, pre-painted mask).
- The Weather Mask row now has two lines, the buttons under the name: with Paint added, one line squeezed the "Weather Mask" label to 10 px in the location panel. Check it reads well in Locations → Media in Advanced mode.
- The tool pill sits bottom center and the card top left, so neither covers Save and Cancel at any desktop width. Below 1024 px, or on any touch screen, the controls stack as on mobile.
- Frames: `.scratch/weather-mask-03/frames/brush-dark.png`, `.scratch/weather-mask-03/frames/brush-light.png`, `.scratch/weather-mask-03/frames/brush-mobile-dark.png`.
