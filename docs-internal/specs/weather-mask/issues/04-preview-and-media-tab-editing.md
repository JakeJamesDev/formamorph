# 04: Weather Preview and Media Tab Editing

Status: ready-for-human
Blocked by: 02, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

While painting, the author sees live weather through the mask in progress, and can open any mask from the Media tab. The spec covers this in Q8 and Q13.

- **Preview.** The brush editor draws the Weather Background through the mask in progress, always on behind the tint, reusing ticket 02's masked drawing. The corner card of Q19 holds the picker for Rain, Snow, Storm and Bright Sun and rests faded like the other controls. Reduced motion uses the calm mode.
- **Media tab.** A Mask row opens the brush editor over a picture that links it; with several, the editor switches which picture shows under the mask. With none, it opens over a plain surface at the mask's size.
- **Docs.** The wiki Media tab page covers opening a mask.

## Acceptance criteria

- [x] The preview shows the chosen weather kind and follows the mask as strokes land. `WeatherMaskControl.test.tsx` › "Weather Mask brush editor preview" (kind pick keeps one canvas; mask changes per stroke); guard proved by mutation.
- [x] A Mask row in the Media tab opens the editor over a linking picture, and switches between linking pictures. `MediaListView.test.tsx` › "opens a Mask in the brush editor over a picture that links it…" (Picture switch lists the linking images, Save writes the entry alone). Picking an option in the switch is not driven in jsdom.
- [x] A Mask no slot links opens over a plain surface and saves. `MediaListView.test.tsx` › "opens a Mask no slot links over a plain surface…"; DOM read on `#dev?modal=weatherMaskEditor&tab=plain`.
- [x] A frame of the preview in rain through a painted window: `.scratch/frames/preview-rain-dark.png`.

## Landed

**Not verified**

- Choosing another picture in the Picture switch: jsdom cannot drive the Radix select, so the switch's list is tested but not the pick itself. The `tab=edit` dev route shows it.
- Light theme and the mobile layout of the new card controls: not framed.

**For you**

- Open a mask from Locations → Media in Advanced mode and judge the preview: Rain, Snow, Storm and Bright Sun through your own mask. `#dev?modal=weatherMaskEditor&tab=edit` (add `plain` for the no-picture case).
- When a mask is shared by images of different shapes, switching picture reshapes the box and keeps the mask's raster, so it stretches as in play. Save keeps the size the editor opened with.
- Frame: `.scratch/weather-mask-04/frames/preview-rain-dark.png`.
