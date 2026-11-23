# 06: Mask Button on the Frame

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The Weather Mask row under each location image is replaced by one button on the image frame. The spec covers this in Q20 and Q21.

- **Button.** A mask icon button on the location image frame, bottom right, in Advanced mode only. It sits with the frame's other buttons (Edit Layers top left, the rule cog top right) and uses the same frame button style.
- **Menu.** With no mask: Paint, Upload, Choose. With a mask: Edit, Replace, Choose, Show or Hide Mask, Remove. When two or more images share the mask, the menu names the count and the mask. Every action keeps its current behavior and history step.
- **Show Mask.** Draws the linked mask over the frame's picture with the brush editor's tint, fit the way the frame fits the picture. Off by default. It never changes the stored world.
- **Row removed.** The thumbnail, "Weather Mask" label, "None" line and the action row under the image go. The slot keeps no space for them.
- **Docs.** The wiki location page and Media tab page describe the button and the menu.

## Acceptance criteria

- [x] In Advanced mode a location image frame shows the mask button; Simple mode and entity, item and other galleries do not. `WeatherMaskButton.test.tsx`: "sits on the frame, bottom right", "is absent in Simple mode", "is absent on an entity gallery"; live DOM read in the location Media panel.
- [x] The menu lists Paint, Upload and Choose with no mask, and Edit, Replace, Choose, Show or Hide Mask and Remove with one; each runs the action the row ran, through the editor's history. Menu-order tests, the upload, Choose, Remove, undo/redo and brush-editor tests now driven through the menu; Edit and Choose opened live from the menu.
- [x] Show Mask draws the tint over the frame's picture, and Hide Mask removes it; a frame with no mask offers no Show Mask. "Show Mask tints the framed picture…", "keeps Show Mask on while stepping…"; guard proved by mutation; live frames.
- [x] The shared count and mask name show in the menu at two or more images. "names the shared count and the Mask at the top of the menu…", "counts slots on other locations too", "names no count for a Mask one image links…".
- [x] Stepping between gallery slots never moves the frame's buttons or the slot strip (global "selections never move their choices" rule), measured across every slot. Live DOM read at 1440×900: mask button, rule button, both tiles and the add tile at the same pixel on Primary, Image 2 and the open slot.
- [x] Frames: a slot with the mask shown and with the menu open, desktop dark and light. `.scratch/weather-mask-06/frames/` (menu-open-dark, mask-shown-dark, menu-open-light, mask-shown-light).

## Landed

**Not verified**
- Upload and Replace opening the OS file picker in a real browser, desktop app and Android: jsdom proves the picker opens inside the menu click; the dialog itself can't be driven from the Browser pane.

**For you**
- Open a location's Media panel in Advanced mode and use the ◐ button at the frame's bottom right: does the menu read well, and is the blue tint over the picture clear? Frames: `.scratch/weather-mask-06/frames/mask-shown-dark.png`, `.scratch/weather-mask-06/frames/menu-open-light.png`.
- Show Mask stays on as you step between images (spec session ruling, folded into Q21).
- Review notes left as is: the button menu repeats `PresetHeaderMenu`'s after-close focus handling (a shared button-menu component would remove the copy), the Show and Hide Mask items use the same eye icon as the Visibility rule button on the same frame, and `docs/Design-System.md` has no entry for the frame button.
