# 06: Motion E2E Spec

Status: in-progress
Base: 3e40afa3
Blocked by: 05
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: per-frame sampling in Playwright is timing-sensitive, and each assertion must be proven
to fail against the real fault it guards.

## What to build

One Playwright spec that proves the motion in numbers. It records, per animation frame, the folder tile's
rectangle in the outer layer and the region's rectangle in the inner layer, for a fly-in and a fly-out on
a scrolled library. The folder under test has left-out members, so the staged reveal is on screen. The
full-screen morph spec is the prior art for the recorder.

The spec runs with `npm run test:e2e`, outside the four gates.

## Acceptance criteria

- [ ] On every sampled frame the folder tile's rectangle in the outer layer equals the region's rectangle in the inner layer within one pixel, in both directions
- [ ] The sampled sizes pass through intermediate values, so an instant swap fails the test
- [ ] On every frame where the outer layer has any opacity, the folder header is at zero opacity and raised; it is at rest on the last frame, and the fly-out mirrors it; the test fails when the header shows from the first frame
- [ ] The clip guard measures the inner layer's clip, not the corner member's box, because the tile's frame crops a sliver of a corner member whose span differs from the tile's
- [ ] The library is scrolled before the fly-in; the test fails when the origin-offset term is removed from the camera function
- [ ] On every frame where the outer layer has any opacity, no part of the inner layer shows past the tile's frame; the test fails when the clip opens from the first frame
- [ ] Neither layer is cut off at the top by the strip the folder header takes: on every frame the board's own top edge is painted, for a folder tile in the board's top row, which is the only place the cut can happen
- [ ] Every clip claim is measured by painted truth, not by a bounding rect (see the note below)
- [ ] On every frame, all left-out members hold one opacity value, and that value is zero before the reveal point; the test fails when the clip opens as a wipe with the members visible
- [ ] On every frame of a fly-out, the zoomed library board is clipped to the board area; the guarantee rests on the scroll viewport's own `overflow`, per the ticket 03 review
- [ ] After each direction no overlay remains and the grid has no inline transform
- [ ] The library scroll offset after the fly-out equals the offset before the fly-in
- [ ] With reduced motion emulated, the folder opens with no animation
- [ ] The library drag parity and library tiles suites pass with a folder opened and closed before the drag
- [ ] Each guard was run once against its reinstated fault and failed; the result is noted in the ticket comments
- [ ] Suite wall-clock time is stated in the handover

## Measure a clip by what reaches the screen

`getBoundingClientRect` reports an element's own box and knows nothing about an ancestor's clip. A check
built on it confirms the clip that was written rather than what the player sees. Ticket 05 shipped a fix
that widened one clip while an ancestor went on cutting at the identical line: the rect check passed, and
nothing changed on screen.

So every assertion here about something being cut off, or not cut off, reads painted pixels or hit tests.
Playwright's `toHaveScreenshot`, a clipped `page.screenshot` compared per frame, or
`page.evaluate` with `elementFromPoint` all respect every ancestor clip. A bounding rect is fine for
*where* a layer stands, which is what the camera lock is about, and is never enough for *whether it shows*.

## Comments

### Built

`e2e/folder-fly-in.spec.ts`, 14 tests across the two projects. Two groups.

**The recorder** samples one frame per `requestAnimationFrame` and writes the folder tile's rectangle in
the library layer, the region's rectangle in the folder layer, both layers' opacity, the header's opacity
and lift, and every member tile's opacity. The library layer is whichever board draws the folder's face,
so one recorder reads both directions with no flag. The reveal point is not a number the test is told: it
is the first frame the library layer reaches zero opacity, which is the one thing about it a player sees.

**The clip group** holds the camera on a frame, photographs a strip, hides one layer with `visibility`,
photographs the same strip again, and compares the two images. A third photograph with the layer back
raises if anything else on the page moved, which would void the reading. Holding the camera pauses every
animation in the document, because the endpoint indicator pulses green right above the board area and its
four pixels sat inside the first strip that was tried.

**The fixture** is a small folder of five worlds in the board's top-left cell. Small on purpose: the face
is then two base columns wide, so the region is a fraction of the board in both axes and the clip has
something real to hold back, and the member in the board's corner is wider than the tile — the sliver case
the clip guard must not read off that member's own box. Four members are left out, so the staged reveal is
on screen. The scrolled tests shorten the window and grow the one loose world, because five of six worlds
are inside the folder and a board of default sizes is one row deep.

### The region is measured, not recomputed

The region's width is the tile's **grid track** divided by the face's own scale, and its shape is the tile's
**painted box**. The two readings are deliberately different. Chromium snaps a grid item's painted box to a
device pixel, so the tile paints 141.22px wide inside a 140.625px track, while the face's scale is built
from the track. Taking both from one reading drifts the region by 1.25px and the lock check fails on a
product that is correct. Measured with the tracks and the box as above, the corners lock to 0.000px and the
sizes to under 0.01px.

That 0.6px is a real, invisible inconsistency in the product: the face is drawn 0.42% small for its own box,
so a sliver of background stands at the face's right edge. Not worth a change, and not this ticket's code.

### Each guard against its reinstated fault

| Guard | Fault put back | Result |
| --- | --- | --- |
| The layers stay locked | `folderCamera` drops the `d` origin-offset term | Red — 1.1px on the first fly-in frame, 90px on the first fly-out frame |
| The sizes are real | Each layer's first keyframe set to its last | Red — 0 intermediate sizes, both directions |
| The header is held back | Header keyframes start at rest | Red — opacity 1 over the library, both directions |
| Left-out members wait for the reveal | Their keyframes start at opacity 1 | Red — a left-out member showed over the library |
| Left-out members hold one opacity | Their offsets staggered 0.15 apart | Red — 0.086 between the highest and the lowest |
| The folder board stays inside the tile frame | The face clip replaced by the open clip | Red — paint outside the frame at 20ms |
| Neither board is cut at the top | The clip walk stops at the nearest ancestor | Red — the folder board lost its top edge at 102ms |
| Neither board is cut at the top | The board area cut to the viewport the swap leaves | Red — the library board stood 47px above the board area |
| A fly-out stays in the board area | Every clip between the board and the body removed | Red — paint below the board area at 277ms |
| The library scroll comes back | The restore branch removed | Red — 0 where 42 was expected |
| Reduced motion gives the instant swap | `reduce` dropped from the guard | Red — a camera ran |
| Nothing is left behind | `animation.cancel()` dropped from cleanup | Red — a board kept the transform the camera put it in |
| A tile still drags after a zoom | `restore` dropped from cleanup | Red — the board never took pointer input again |

One negative worth keeping: setting `overflow: visible` on the scroll viewport alone, during a fly-out,
changes **nothing** on screen, so that guard stays green. The scroll area's own root stands on the same
rectangle and goes on clipping at the identical line. Same lesson as ticket 05, now measured from the
other side. The guard needs every clip between the board and the body removed before it turns red, which
is the fault it is actually there for.

### Two faults in the test itself, found by measurement

- **A locator click undid the scroll it was testing.** Playwright scrolls a partly hidden element fully
  into view before clicking, and on a scrolled library that is the folder tile. The fly-in ran from an
  unscrolled board and proved nothing about the `d` term; the fly-out then found the offset back at 0 and
  read it as a broken restore. The tile is now pressed with the real mouse where it stands.
- **The hold latched a CSS transition instead of the camera.** A control inside the folder header runs its
  own transition when the back button is pressed, and it matched the same selector. Every seek after that
  meant a different clock and the camera ran to the end unheld. The hold now waits for the raised frame and
  takes only script-driven `Animation` objects.

### Not covered here

`library-drag-parity.spec.ts` and `library-tiles.spec.ts` are untouched, per the spec session's ruling: the
parity suite has to run unchanged against the pre-tile-board commit. The drag-after-a-zoom guard lives in
this file instead. Both suites were run as they stand and are green.

### Wall-clock

| Run | Result | Time |
| --- | --- | --- |
| `npx playwright test folder-fly-in` (both projects) | 14 passed | **2m 03s** |
| `folder-fly-in` + `library-tiles` + `library-drag-parity` | 52 passed, 2 skipped | **4m 55s** |

The three suites' own tests sum to about 250s against a 295s total. The gap is the four dev servers
starting, not a handle the run leaves open.

Four gates, run this turn: `typecheck` 0 errors · `lint` 0 errors (one pre-existing warning in
`WorldOverviewManager.tsx`) · `test` 11796 passed, 3 skipped in 95.6s · `build` succeeded in 20.4s.
