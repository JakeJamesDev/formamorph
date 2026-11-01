# 01: Backdrop Opacity

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Small, well-bounded change with a working prototype to copy from.

## What to build

An author with a too-bright Custom Image Backdrop moves an opacity slider in the Body Layout editor. The image fades in the editor and on the Inventory panel's doll. The value survives save, export and import. Default is 100%, so current worlds look the same.

This ticket also owns the larger dev fixture from the prototype (9 slots, worn items, a bright image Backdrop), so that tickets 02 and 04 can check against it.

Rulings: Q14. Prototype: branch `prototype/doll-cleanup`, commit a04717109.

## Acceptance criteria

- [ ] The Body Layout editor shows an opacity slider for a Custom Image Backdrop only, not for Humanoid, Quadruped or Plain.
- [ ] Opacity applies in the editor and on the doll.
- [ ] The Backdrop parser keeps and clamps the value on load. A test fails when the parser drops it.
- [ ] Replacing the image keeps the value. Absent reads as 100%.
- [ ] A world export and import keeps the value.
- [ ] The `items` dev fixture has 9 slots, worn items and a bright image Backdrop.
- [ ] Frames at 100% and 30%, in both themes at 1366: `.scratch/frames/opacity-100-light.png`, `opacity-100-dark.png`, `opacity-30-light.png`, `opacity-30-dark.png`.
- [ ] Docs that describe Body Layouts name the slider, and a changelog fragment exists.
- [ ] The response carries the export-shape reminder.

For you: a bright image of your own at a low opacity, on the doll in the Inventory panel. Does the fade make the boxes read?
