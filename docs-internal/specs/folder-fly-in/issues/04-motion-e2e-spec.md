# 04: Motion E2E Spec

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: per-frame sampling in Playwright is timing-sensitive, and each assertion must be proven
to fail against the real fault it guards.

## What to build

One Playwright spec that proves the motion in numbers. It records, per animation frame, the folder tile's
rectangle in the outer layer and the inner layer's rectangle, for a fly-in and a fly-out on a scrolled
library. The full-screen morph spec is the prior art for the recorder.

The spec runs with `npm run test:e2e`, outside the four gates.

## Acceptance criteria

- [ ] On every sampled frame the folder tile's rectangle in the outer layer equals the inner layer's rectangle within one pixel, in both directions
- [ ] The sampled sizes pass through intermediate values, so an instant swap fails the test
- [ ] The library is scrolled before the fly-in; the test fails when the origin-offset term is removed from the camera function
- [ ] After each direction no overlay remains and the grid has no inline transform
- [ ] The library scroll offset after the fly-out equals the offset before the fly-in
- [ ] With reduced motion emulated, the folder opens with no animation
- [ ] The library drag parity and library tiles suites pass with a folder opened and closed before the drag
- [ ] Each guard was run once against its reinstated fault and failed; the result is noted in the ticket comments
- [ ] Suite wall-clock time is stated in the handover
