# 05: Custom Backdrop Image

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A contained addition on an existing image path.

## What to build

The Backdrop select gains Custom Image. It uses the entity image path: upload, linking and Downscale (Q30). The Backdrop's aspect follows the image, and the bottom-edge drag hides for it (Q15). Boxes keep their fractions when the image changes (Q16).

Check that world export, Downscale presets and the in-use image readers see the new reference.

## Acceptance criteria

- [ ] An author picks Custom Image and uploads a file, and the Backdrop draws it at the image's aspect.
- [ ] The aspect drag does not show on a Custom Image.
- [ ] The image exports with the world and survives import.
- [ ] Downscale presets reach it, and a linked image follows the existing linking rules.
- [ ] Switching back to an outline keeps the boxes.
