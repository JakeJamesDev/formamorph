# 06: Mask Button on the Frame

Status: ready-for-agent
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

- [ ] In Advanced mode a location image frame shows the mask button; Simple mode and entity, item and other galleries do not.
- [ ] The menu lists Paint, Upload and Choose with no mask, and Edit, Replace, Choose, Show or Hide Mask and Remove with one; each runs the action the row ran, through the editor's history.
- [ ] Show Mask draws the tint over the frame's picture, and Hide Mask removes it; a frame with no mask offers no Show Mask.
- [ ] The shared count and mask name show in the menu at two or more images.
- [ ] Stepping between gallery slots never moves the frame's buttons or the slot strip (global "selections never move their choices" rule), measured across every slot.
- [ ] Frames: a slot with the mask shown and with the menu open, desktop dark and light.
