# 05: Praline File

Status: ready-for-human
Blocked by: 02, 03, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The key math is proven on the maid, but this rig differs: 14 `Body` primitives, a stocking layer and a fox tail.

## What to build

A finished Praline file exists in `build-assets`, ready for ticket 07 to ship. It has body keys, working hair, eye, skin and stocking pickers, the name `Praline`, the pixiv author and a white-background embedded thumbnail.

The spec's `tools/build-praline.py` already does the hair, iris and stocking work on `D:\Downloads\AvatarSample_F.vrm`. The stockings are a separate cutout `CLOTH` material offset along normals. Add `Waist`, `Bust` and `Thickness` using the method in `tools/build-release-avatar.py`, with every `Body` primitive receiving the morph. The stocking layer must move with the skin, or skin shows through. Tune the tail so it doesn't tear.

For default colors, use the spec's factor method from ticket 04, which restores the source look without narrowing the pickers.

Keep all generation in the script, so the file rebuilds from its source. Regenerate the client fingerprints in this landing, adding her file to the fingerprint and bundled-avatar lists. `npm run fingerprints` crashes on old world revisions when the shipped-world cache is cold. If that is still true, add her hash to the list directly as ticket 04 did, and still add her file to the generator's list. Add her to the provenance record that ticket 04 starts.

No build ships her until ticket 07.

Rulings: Q20, Q23, Q24, Q26.

## Acceptance criteria

- [x] The metadata meets every requirement in the spec's gate list, shown by a script read. `tools/check-avatar-license.py` prints PASS.
- [x] Each key exists on all 14 `Body` primitives plus the stocking primitive, shown by a script read. All 15 primitives hold the same three targets.
- [x] At full key values the stocking layer stays outside the skin, shown by a measured gap and a frame. On the 2,228 visible stocking triangles at 1.25 on all keys: gap min 0.442 mm, median 0.572 mm, none negative. Frame: `praline-keys-max.png`.
- [x] Hair, eye, skin and stocking pickers each move only their own part, read through `verify-ui`. Material color reads on the real `VRMViewer` in a Playwright harness: hair changes the 3 hair materials, eye the iris, skin Face and Body, stocking its own material. Revert changes 0 pixels.
- [x] Default hair and eye colors match the source look as closely as the pickers allow. Texture medians times factors return the source medians. Hair and face rows differ from the source by more than 8 levels on 402 of 700,000 pixels, mostly hair shine and iris brights.
- [x] Rerunning the script from the source file gives a byte-identical result. Two builds, sha256 `d9b84905…f6c9` both.
- [x] The fingerprint test passes with her hash. Run by the gates. `npm run fingerprints` still crashes on a cold cache, so the hash went in directly and the file joined the generator's list.
- [x] Frames: `.scratch/frames/praline-default.png` and `.scratch/frames/praline-keys-max.png`, front and side.

## Landed

Keys use the method in `build-release-avatar.py`. Tail edge stretch at `Thickness` was 2.68 from the generated offsets, so the tail now takes its root vertex's offset as one piece. Stretch is 1.0. The nearest tail-to-body distance is 2.2 mm at rest, 1.2 mm at 1.25 and 2.6 mm at -0.25, so she keeps the tail attached.

172 of the 2,400 stocking triangles sit fully in transparent texture, 8 of them at the wrists with gaps as low as -0.33 mm. The cutout discards them. The coarse selection picks them, and they don't render.

The stocking layer's shade stays the neutral (0.82, 0.78, 0.8) from the prototype, so the leg shadows are grayer than the source's pink. That accounts for most pixel differences on the legs.

**Not verified**
- Nothing unticked. Character Customization itself can't list her until ticket 07, so the picker reads ran on `VRMViewer` directly, and her Other Colors row was read from the capabilities list.

**For you**
- Praline's keys at full values, including stockings and tail, in `.scratch/release-avatar-license-05/frames/praline-keys-max.png`. Load the file in Character Customization if the frames don't settle it.
- Her default look, in `.scratch/release-avatar-license-05/frames/praline-default.png`.
- The stocking picker is the Other Colors row labeled `N00 000 00 Stockings 00 CLOTH`.
- The hair swatch opens at `#140705`, darker than the rendered hair median (52, 28, 22). The eye swatch opens at `#106238` over a rendered median of (30, 98, 74).
- Picking a seed color is not the identity, against 700x1000 renders. Hair changes 16,180 pixels (max 113), because one seed goes to three hair materials and the shade factor is overwritten. Skin changes 13,735 (max 28), and Sei's skin changes 30,646 (max 49), from the same shade overwrite. Eye changes 173 (max 1).
- At full keys the skirt's top decoration and apron look faceted, the same limit as on Sei.
