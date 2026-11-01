# 07: Emberwatch Layouts

Status: ready-for-agent
Blocked by: 01, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Authoring work in one world file.

## What to build

Author real layouts on Emberwatch's Humanoid and Hound Bodies: Humanoid on the Humanoid outline, Hound on the Quadruped outline. Boxes sit on the body parts they equip to, on the outlines the user approved in ticket 04 (Q69), using the slots from ticket 01. Follow the bundled-worlds skill, and don't read the world JSON raw.

## Acceptance criteria

- [ ] Both Bodies have an authored Backdrop and boxes, and no box is left at the default center.
- [ ] Main Hand and Off Hand sit on the two hands, and mirror around the midline.
- [ ] Emberwatch loads and the bundled-world tests pass.
- [ ] A frame saved as `.scratch/frames/emberwatch-layouts.png` shows both Bodies in the editor.
