# 03: Median Skin Tint

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A small math change with a visible result. Reproduce it with a real texture first.

## What to build

The same skin picker value renders Body and Face at matching brightness. Today the picker seeds from the Face average while tinting divides by each texture's own mean, and dark areas pull the Body mean down, so Body comes out brighter. Tinting uses the median of opaque pixels instead of the mean.

The linear-tint fix in the spec is optional and not ruled. It stays out of this ticket.

Source for checking: `D:\Downloads\maid-proto.vrm`, the accepted maid file. Its Body starts pale because of this.

## Acceptance criteria

- [ ] A test on a texture with large dark areas gets the median, and the mean would fail it.
- [ ] Fully transparent pixels don't count toward the median.
- [ ] Measured Body and Face render colors on the maid file are closer than before, with both sets of numbers in the Landed notes.
- [ ] The Elaina file and the tracked default still respond to all three pickers.
- [ ] A changelog fragment is added.
- [ ] Frames: `.scratch/frames/tint-before.png` and `.scratch/frames/tint-after.png`, the maid in Character Customization at 1366.

For you: skin tone across Face and Body in the frames above.
