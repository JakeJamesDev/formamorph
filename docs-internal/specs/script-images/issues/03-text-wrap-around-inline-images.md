# 03: Text Wrap Around Inline Images

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A During AI Output image with `wrap: 'left'` or `wrap: 'right'` floats in the narration, and the sentences after it wrap around it. On mobile it renders as a block. The spec covers this in Q3 and Q13.

- **Render.** `left` and `right` float inside the narration column and inside the Chat bubble. The text segments after the image wrap around it. The float never runs past the end of the turn's narration.
- **Mobile.** Below the mobile breakpoint, every float renders as a block.
- **Design System.** Add the inline image (block, left, right; small, medium, large) to the dev-router showcase.
- **Docs.** Document `wrap` in [Scripts-Reference.md](docs/Scripts-Reference.md). Write a changelog fragment.

## Acceptance criteria

- [x] A `left` image renders floated left in Pages and Chat layouts, and the next sentence's text sits beside it. Tests "floats a left image and a right image" and "floats an image inside the turn’s bubble"; showcase DOM read: `float: left`, and the frame shows text beside it.
- [x] A `right` image renders floated right. Same tests; showcase DOM read: `float: right`.
- [x] At mobile width, `left` and `right` images render as blocks. Showcase DOM read at 375 px: `float: none` on every variant.
- [x] A float on the last sentence does not overlap the turn below it. Test "holds a float on the last sentence inside the narration" (`flow-root` parent); layout itself not rendered in a game turn.
- [x] The Design System showcase lists the inline image variants. Test `InlineScriptImageReference`; nine variants.
- [ ] Frames of left and right floats at desktop width in light and dark, and of the same turn at mobile width: `.scratch/frames/wrap-left-desktop-light.png`, `.scratch/frames/wrap-right-desktop-dark.png`, `.scratch/frames/wrap-chat-desktop-light.png`, `.scratch/frames/wrap-mobile-light.png`.

For you: approve the float styling in the frames and the showcase as a new visual pattern.

## Landed

**Not verified**

- The four named frames. One frame exists: `.scratch/frames/wrap-left-desktop-dark.jpg`, the showcase in the dark theme. The right, Chat and mobile frames and the light variants were not captured.
- A float inside a real game turn in Pages or Chat: jsdom has no layout, so the tests check classes and DOM order, and the layout reads come from the showcase only.

**For you**

- Approve the float styling (small 33%, medium 60%, gap 1rem on the text side) in the Design System showcase, under Inline Script Image.
- Look at a float in a real turn in both layouts, since only the showcase was drawn.

Rulings Q31 (a large float is a block) and Q32 (the `md` breakpoint, CSS only) came from the spec session and are not in `spec.md` yet.

## Comments

- Spec session, after landing: frames captured in a real turn through the new `scriptImages` dev fixture (42c46ed10): `.scratch/script-images-03/frames/wrap-pages-desktop-light.jpg`, `wrap-pages-desktop-dark.jpg`, `wrap-chat-desktop-light.jpg`, `wrap-mobile-light.jpg`. Left and right floats wrap in Pages and Chat; both render as centered blocks at 375 px.
