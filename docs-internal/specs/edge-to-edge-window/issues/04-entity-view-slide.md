# 04: Entity View Slide

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rulings: Q11. Workload: one small, well-specified animation with measured acceptance.

## What to build

The Entity View chevron points up when expanded and down when collapsed. It turns while the section slides over 200ms, on the same curve as the nav rail. The section clips at full size, so a model never resizes during the slide, and the tabs below move with it.

The entity view stays mounted through the close, then unmounts to release the model, as it does today. With reduced motion, the chevron and section change at once.

## Acceptance criteria

- [ ] Per-frame Playwright samples show the section's height moving from full to 0 in about 200ms on close, and from 0 to full on open, with a real entity image.
- [ ] The content's own height stays constant through the slide.
- [ ] The chevron finishes its 180° turn with the section, and rests up when expanded and down when collapsed.
- [ ] The tabs below move with the section, and nothing jumps at the end.
- [ ] The entity view unmounts after the close, and reopening works with an image and with a 3D Model.
- [ ] Toggling quickly in both directions ends in the correct state.
- [ ] With reduced motion, the height and chevron change on the first frame.

For you: open and close the Entity View with your own character model and judge the feel.
