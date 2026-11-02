# 04: Sei And Aki Files

Status: ready-for-agent
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

- [ ] Each file's metadata meets every requirement in the spec's gate list, shown by a script read.
- [ ] Sei has `Waist`, `Bust` and `Thickness` keys and the library label Sei. Aki has the label Aki and no body keys.
- [ ] Every other metadata field on Sei matches the Hub file, including `authors`.
- [ ] Both embedded thumbnails have a white background.
- [ ] The fingerprint test passes with both new hashes, and Elaina's hash stays in the list.
- [ ] The release workflow's swap steps are unchanged, and no tracked file outside history holds Elaina.
- [ ] All sliders and pickers respond on both files in Character Customization, read through `verify-ui`.
- [ ] A changelog fragment is added.
- [ ] Frames: `.scratch/frames/sei-customization.png` and `.scratch/frames/aki-customization.png` at 1366.

For you: Sei's and Aki's default look and thumbnails, in the frames above.
For you: remove the one Elaina listing after the next release ships (Q12).
