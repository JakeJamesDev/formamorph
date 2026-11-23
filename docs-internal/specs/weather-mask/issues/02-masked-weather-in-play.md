# 02: Masked Weather in Play

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

In play, the Weather Background shows only where the shown location image's mask allows, lined up with the picture on any screen shape. The spec covers this in Q3, Q4, Q6, Q7 and Q9–Q11.

- **Mask in force.** The mask of the location image that shows now: the primary visible image under its Visibility rules, read the way the location art is read. A past page reads its own location and image.
- **Weather view decision.** It gains the mask in force as one input and carries it in the background output. No mask: unchanged. Mask in an open location: shown, limited to the mask. Mask in a Sheltered location: shown, limited to the mask. Location Background off or no image: mask ignored. Clear, Bright Sun after dark, the Weather Background switch and reduced motion apply as before. The Weather Foreground and the narrator line ignore the mask.
- **Rendering.** The Weather Background applies a luminance CSS mask. Its box comes from the image's natural size and the viewport, so it matches the cover crop, and the mask stretches to that box. Transparent reads as black. The Background Fade dims it with the art. The dev weather bar's backdrop override draws with no mask. This ticket owns the masked drawing; ticket 04's preview reuses it.
- **Docs.** The wiki Weather section of the Overview page and the location page say what a mask does in play.

## Acceptance criteria

- [ ] The weather view decision has one test per rule above, including Sheltered with and without a mask.
- [ ] A GameViewer render test reads the weather layer's mask from the DOM for the shown image; a day/night pair sharing one mask shows it on both; a past page shows its own image's mask.
- [ ] With Location Background off, the weather layer carries no mask.
- [ ] Frames of a masked window in rain show the weather inside the window only: `.scratch/frames/mask-desktop-dark.png` and `.scratch/frames/mask-desktop-light.png` at 1280 wide, `.scratch/frames/mask-mobile-dark.png` at 390 wide.

For you: in play, check that rain lines up with the window and the edge looks right in a world of your own.
