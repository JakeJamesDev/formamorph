# 04: Sei And Aki Files

Status: done
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

This ticket removes Elaina from future releases. The default-color choice is the only open judgment.

## What to build

A release build's default Avatar is Sei, and a local or Pages build's default is Aki. Both pass the stricter gate from their own metadata.

- **Sei:** run the spec's `tools/build-release-avatar.py` on `D:\Downloads\4217129588480535626.vrm` with the name `Sei`. Check the source file still has 15,069,648 bytes. Capture and embed her thumbnail with ticket 02's tools, and keep her author. She replaces the alternate Avatar file.
- **Aki:** start from `D:\Downloads\AvatarSample_A_final.vrm`. Set the name `Aki`, and recapture her thumbnail with the white background. The pixiv author and the permissive fields stay. She has no body keys. She replaces the tracked default.
- **Default colors (Q26):** hair and eyes match the source look as closely as the pickers allow. Sei's source hair is flat black, and multiply tinting can't lift a dark texture, so her base stays a neutral mid-tone unless you find a way to keep both. Ask the spec session if the two conflict.
- **Fingerprints:** regenerate the client list in this landing. The fingerprint test fails without it.
- **Provenance:** a record beside the spec holds source URL, author, download date and the metadata as downloaded for each model. Sei's Hub conditions are already saved in `evidence`.

The existing gate still applies here. Tickets 01 and 06 hold the files to the stricter gate, and ticket 01 waits to land until this ticket has. Check the files against the spec's requirements by script in this ticket, and send ticket 01's session one message after the landing.

Rulings: Q1, Q14, Q17, Q19, Q23, Q24, Q26.

## Acceptance criteria

- [x] Each file's metadata meets every requirement in the spec's gate list, shown by a script read. `tools/check-avatar-license.py` prints PASS for both.
- [x] Sei has `Waist`, `Bust` and `Thickness` keys and the library label Sei. Aki has the label Aki and no body keys. File read on all 5 Body primitives; both labels read from the seeded and added library records.
- [x] Every other metadata field on Sei matches the Hub file, including `authors`. Script diff: only `name` changed.
- [x] Both embedded thumbnails have a white background. Pixel read of the top corners: (255,255,255,255) on both.
- [x] The fingerprint test passes with both new hashes, and Elaina's hash stays in the list. Affected tests green; list read shows Elaina's hash kept.
- [x] The release workflow's swap steps are unchanged, and no tracked file outside history holds Elaina. Workflow not in the diff; `git ls-files '*.vrm'` lists only the two files, named Sei and Aki.
- [x] All sliders and pickers respond on both files in Character Customization, read through `verify-ui`. Playwright pixel diffs: each picker and each of Sei's sliders moves the render. Aki has no sliders.
- [x] Carried from ticket 03, which had no free preview slot: Face and Body render at matching color on Sei at the default skin value, and all three pickers respond on the Elaina file, which existing players keep. Read Elaina from file history. Sei Face (250,235,222), Body (249,230,216), same as the Hub file. Elaina pickers: 4034, 66 and 13239 pixels changed.
- [x] A changelog fragment is added. Two: the Avatar change and the picker fix.
- [x] Frames: `.scratch/frames/sei-customization.png` and `.scratch/frames/aki-customization.png` at 1366.

For you: Sei's and Aki's default look and thumbnails, in the frames above.
For you: remove the one Elaina listing after the next release ships (Q12).

## Landed

Sei's untouched render matches the Hub file: seeds read `#000000` hair and `#4a0000` eye. On all three models, opening a picker without moving it, picking the seed color, and Revert each changed 0 pixels.

The picker seed multiplies an sRGB median by a linear factor. It is exact for factors of 0 and 1, the only ones Sei and Aki use. A third-party file with a mid factor seeds darker than it renders, and picking that seed still restores the factor. This is the spec's unruled linear-tint note.

`npm run fingerprints` crashes on main in `bodyMedia`, on old world revisions with a cold cache. The two hashes were added directly, which matches the generator's avatar output because no world changed.

**Not verified**
- Nothing unticked. Picker opening was checked with a click and Escape, since Playwright can't drive the native color dialog.

**For you**
- Sei's and Aki's default look and thumbnails, in `.scratch/release-avatar-license-04/frames/sei-customization.png` and `.scratch/release-avatar-license-04/frames/aki-customization.png`.
- Sei's left stocking shows a thin white strip on its inner edge. The Hub file shows it too.
- Remove the one Elaina listing after the next release ships (Q12).
