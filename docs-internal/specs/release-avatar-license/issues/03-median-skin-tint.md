# 03: Median Skin Tint

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A small math change with a visible result. Reproduce it with a real texture first.

## What to build

The same skin picker value renders Body and Face at matching brightness. Today the picker seeds from the Face average while tinting divides by each texture's own mean, and dark areas pull the Body mean down, so Body comes out brighter. Tinting uses the median of opaque pixels instead of the mean.

The linear-tint fix in the spec is optional and not ruled. It stays out of this ticket.

Source for checking: `D:\Downloads\maid-proto.vrm`, the accepted maid file. Its Body starts pale because of this.

## Acceptance criteria

- [x] A test on a texture with large dark areas gets the median, and the mean would fail it. (`textureMedian.test.ts` "ignores large dark areas"; swapping in a mean turned it red.)
- [x] Fully transparent pixels don't count toward the median. (`textureMedian.test.ts` "does not count fully transparent pixels".)
- [x] Measured Body and Face render colors on the maid file are closer than before, with both sets of numbers in the Landed notes. (Computed from the file's textures; see Landed.)
- [ ] The Elaina file and the tracked default still respond to all three pickers.
- [x] A changelog fragment is added. (`docs-internal/changelog.d/03-median-skin-tint.md`.)
- [ ] Frames: `.scratch/frames/tint-before.png` and `.scratch/frames/tint-after.png`, the maid in Character Customization at 1366.

For you: skin tone across Face and Body in the frames above.

## Landed

The median is `medianOpaqueRGB` in `src/lib/textureMedian.ts`; `VRMViewer.tsx` calls it where the mean was. It is per channel, over pixels with alpha of 10 or more.

Maid file, rendered typical (median) pixel at the untouched picker value, clamped to 0..1. The numbers come from the file's own Face and Body textures, with the same divide-by-statistic math as `tintByAverage`:

| | Face (R, G, B) | Body (R, G, B) |
|---|---|---|
| Before (mean) | 0.976, 0.910, 0.855 | 1.000, 1.000, 1.000 |
| After (median) | 0.976, 0.910, 0.855 | 0.976, 0.910, 0.855 |

Texture statistics behind these: Face mean 0.976, 0.901, 0.846 and median 0.976, 0.910, 0.855. Body mean 0.707, 0.654, 0.617 and median 0.969, 0.863, 0.796.

**Not verified**
- Elaina file and tracked default respond to all three pickers: no browser check, because the preview pane had no free server slot (five servers from other chats).
- Frames `tint-before.png` and `tint-after.png`: same reason. No frames are stored.

**For you**
- Skin tone across Face and Body: open the maid in Character Customization at 1366 and compare Face and Body at the default skin color.
- Elaina and the tracked default: move the skin, hair and eye pickers and check each one still changes color.
