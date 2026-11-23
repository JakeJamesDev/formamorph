# 04: Weather Preview and Media Tab Editing

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

While painting, the author sees live weather through the mask in progress, and can open any mask from the Media tab. The spec covers this in Q8 and Q13.

- **Preview.** The brush editor draws the Weather Background through the mask in progress, reusing ticket 02's masked drawing, with a picker for Rain, Snow, Storm and Bright Sun. Reduced motion uses the calm mode.
- **Media tab.** A Mask row opens the brush editor over a picture that links it; with several, the editor switches which picture shows under the mask. With none, it opens over a plain surface at the mask's size.
- **Docs.** The wiki Media tab page covers opening a mask.

## Acceptance criteria

- [ ] The preview shows the chosen weather kind and follows the mask as strokes land.
- [ ] A Mask row in the Media tab opens the editor over a linking picture, and switches between linking pictures.
- [ ] A Mask no slot links opens over a plain surface and saves.
- [ ] A frame of the preview in rain through a painted window: `.scratch/frames/preview-rain-dark.png`.
