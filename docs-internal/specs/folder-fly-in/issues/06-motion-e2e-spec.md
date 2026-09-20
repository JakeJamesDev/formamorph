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
