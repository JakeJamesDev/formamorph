# 05: Praline File

Status: ready-for-agent
Blocked by: 02, 03, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The key math is proven on the maid, but this rig differs: 14 `Body` primitives, a stocking layer and a fox tail.

## What to build

A finished Praline file exists in `build-assets`, ready for ticket 07 to ship. It has body keys, working hair, eye, skin and stocking pickers, the name `Praline`, the pixiv author and a white-background embedded thumbnail.

The spec's `tools/build-praline.py` already does the hair, iris and stocking work on `D:\Downloads\AvatarSample_F.vrm`. The stockings are a separate cutout `CLOTH` material offset along normals. Add `Waist`, `Bust` and `Thickness` using the method in `tools/build-release-avatar.py`, with every `Body` primitive receiving the morph. The stocking layer must move with the skin, or skin shows through. Tune the tail so it doesn't tear.

For default colors, use the spec's factor method from ticket 04, which restores the source look without narrowing the pickers.

Keep all generation in the script, so the file rebuilds from its source. Regenerate the client fingerprints in this landing, adding her file to the fingerprint and bundled-avatar lists. Add her to the provenance record that ticket 04 starts.

No build ships her until ticket 07.

Rulings: Q20, Q23, Q24, Q26.

## Acceptance criteria

- [ ] The metadata meets every requirement in the spec's gate list, shown by a script read.
- [ ] Each key exists on all 14 `Body` primitives plus the stocking primitive, shown by a script read.
- [ ] At full key values the stocking layer stays outside the skin, shown by a measured gap and a frame.
- [ ] Hair, eye, skin and stocking pickers each move only their own part, read through `verify-ui`.
- [ ] Default hair and eye colors match the source look as closely as the pickers allow.
- [ ] Rerunning the script from the source file gives a byte-identical result.
- [ ] The fingerprint test passes with her hash.
- [ ] Frames: `.scratch/frames/praline-default.png` and `.scratch/frames/praline-keys-max.png`, front and side.

For you: Praline's keys at full values, including stockings and tail, in the frames above. Load the file in Character Customization if the frames don't settle it.
