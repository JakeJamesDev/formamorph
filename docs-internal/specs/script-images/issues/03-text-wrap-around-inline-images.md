# 03: Text Wrap Around Inline Images

Status: ready-for-agent
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

- [ ] A `left` image renders floated left in Pages and Chat layouts, and the next sentence's text sits beside it.
- [ ] A `right` image renders floated right.
- [ ] At mobile width, `left` and `right` images render as blocks.
- [ ] A float on the last sentence does not overlap the turn below it.
- [ ] The Design System showcase lists the inline image variants.
- [ ] Frames of left and right floats at desktop width in light and dark, and of the same turn at mobile width: `.scratch/frames/wrap-left-desktop-light.png`, `.scratch/frames/wrap-right-desktop-dark.png`, `.scratch/frames/wrap-chat-desktop-light.png`, `.scratch/frames/wrap-mobile-light.png`.

For you: approve the float styling in the frames and the showcase as a new visual pattern.
