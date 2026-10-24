# 11: Optimize Reads the Index

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A close-spec review gap. The spec says the World Editor and Optimize Images both read the media index. Optimize's count does, but its shrink pass walks each image field by hand, so a new image slot must be added in two places.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

Optimize Images finds the images to shrink, and each image's cap, through the media index, and writes each result back by the item's slot. The thumbnail, entity galleries, location galleries, dictionary cover images and Map Background images all come through that one path. A new image slot in the index reaches Optimize with no second edit.

Behavior stays the same: the same images, the same caps (thumbnail, entity, background, map), the same progress count, cancel, consent dialog and one history step. Gallery rule rows and order survive a run untouched.

No docs or changelog change: nothing a player sees moves.

## Acceptance criteria

- [ ] The shrink pass takes its image list and caps from the media index, not from per-field code
- [ ] A world with every image kind optimizes to the same result as before (existing optimize tests stay green)
- [ ] Rule rows, gallery order and linked images come through a run unchanged
- [ ] A guard test fails when an image slot the index lists is skipped by the shrink pass
