# 07: Emberwatch Layouts

Status: ready-for-human
Blocked by: 01, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Authoring work in one world file.

## What to build

Author real layouts on Emberwatch's Humanoid and Hound Bodies: Humanoid on the Humanoid outline, Hound on the Quadruped outline. Boxes sit on the body parts they equip to, on the outlines the user approved in ticket 04 (Q69), using the slots from ticket 01. Follow the bundled-worlds skill, and don't read the world JSON raw.

## Acceptance criteria

- [x] Both Bodies have an authored Backdrop and boxes, and no box is left at the default center. Humanoid and Quadruped Backdrops with fitted aspects; the editor frame shows each box on its part.
- [x] Main Hand and Off Hand sit on the two hands, and mirror around the midline. Off Hand x = 1 − Main Hand x − width; outline midline is x = 50.
- [ ] Emberwatch loads and the bundled-world tests pass. Loads in the editor (frame); the bundled-world tests run in prepare's gates.
- [x] A frame saved as `.scratch/frames/emberwatch-layouts.png` shows both Bodies in the editor.

## Landed

**Not verified**
- Bundled-world tests: they run in prepare's gates, not before.

**For you**
- Equipment Settings in Emberwatch: check each box sits where you want it on both figures.
- The Hound has no hand slots, so only Neck and Body show on it.
