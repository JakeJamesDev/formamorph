# 05: Motion E2E Spec

Status: ready-for-agent
Blocked by: 04
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
- [ ] The library is scrolled before the fly-in; the test fails when the origin-offset term is removed from the camera function
- [ ] On every frame where the outer layer has any opacity, no part of the inner layer shows past the tile's frame; the test fails when the clip opens from the first frame
- [ ] On every frame, all left-out members hold one opacity value, and that value is zero before the reveal point; the test fails when the clip opens as a wipe with the members visible
- [ ] On every frame of a fly-out, the zoomed library board is clipped to the board area; the guarantee rests on the scroll viewport's own `overflow`, per the ticket 03 review
- [ ] After each direction no overlay remains and the grid has no inline transform
- [ ] The library scroll offset after the fly-out equals the offset before the fly-in
- [ ] With reduced motion emulated, the folder opens with no animation
- [ ] The library drag parity and library tiles suites pass with a folder opened and closed before the drag
- [ ] Each guard was run once against its reinstated fault and failed; the result is noted in the ticket comments
- [ ] Suite wall-clock time is stated in the handover
