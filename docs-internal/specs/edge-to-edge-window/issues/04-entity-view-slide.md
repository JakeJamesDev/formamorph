# 04: Entity View Slide

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rulings: Q11. Workload: one small, well-specified animation with measured acceptance.

## What to build

The Entity View chevron points up when expanded and down when collapsed. It turns while the section slides over 200ms, on the same curve as the nav rail. The section clips at full size, so a model never resizes during the slide, and the tabs below move with it.

The entity view stays mounted through the close, then unmounts to release the model, as it does today. With reduced motion, the chevron and section change at once.

## Acceptance criteria

- [x] Per-frame Playwright samples show the section's height moving from full to 0 in about 200ms on close, and from 0 to full on open, with a real entity image. (`entity-view-slide.spec.ts` "closing slides…": close finishes in 120–320ms, open reaches full within 400ms)
- [x] The content's own height stays constant through the slide. (same spec: one rounded content height on every frame)
- [x] The chevron finishes its 180° turn with the section, and rests up when expanded and down when collapsed. (same spec: passes through 0–180, rests at 180 closed and 0 open)
- [x] The tabs below move with the section, and nothing jumps at the end. (same spec: tab list top tracks the height lost on every frame and rests at the exact offset)
- [ ] The entity view unmounts after the close, and reopening works with an image and with a 3D Model. (unmount and image reopen verified in the spec and `useSlidePresence.test.ts`; 3D Model reopen not driven)
- [x] Toggling quickly in both directions ends in the correct state. ("toggling quickly…" with odd and even counts, plus the hook's interrupt tests)
- [x] With reduced motion, the height and chevron change on the first frame. ("with reduced motion…" reads the first frame)

For you: open and close the Entity View with your own character model and judge the feel.

## Landed

**Not verified**
- Reopening with a 3D Model: the browser fixture has an image only. No browser run drove a model through the slide.

**For you**
- Open and close the Entity View with your own character model and judge the feel.
- The chevron now draws at 20px beside the 20px Back and Music icons. Check that the row looks level.
