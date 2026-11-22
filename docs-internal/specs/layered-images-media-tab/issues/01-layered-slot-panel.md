# 01: Layered Slot Panel

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A gallery slot that links a Layered Image behaves like a flat image's slot wherever the shared image gallery field shows it: the Media tab in Group by Entity, and the entity editor's gallery. The spec covers this in Q1, Q2, Q4, Q6 and Q7.

- **Panel parity.** The slot shows the flat-slot panel: name field (renames the Layered Image), title, size line, action row and Visibility Rule.
- **Title.** The card and panel take the Layered Image's name ("Roxanne › Roxanne Bare"), not the slot's ("Image 2").
- **Size line.** "Layered Image · N Layers · total size", with each part image counted once.
- **Actions.** **Download** saves the flattened outside-play picture. **Remove From Slot** unlinks this slot only (no Replace, per spec Q10; **Choose** on the emptied slot lists Layered Images) and leaves the Layered Image in the Media List.
- **Edit Layers.** A button beside **Download** opens the existing editor: the full-screen editor on desktop and the Layer panel on mobile. This ticket owns that action-row button; ticket 02 reuses it.
- **Docs.** The World Editor Media page says where Edit Layers sits on a gallery slot.

## Acceptance criteria

- [x] In Group by Entity, selecting a layered slot shows the name field, size line, Download, Replace, Remove, Edit Layers and Visibility Rule. Replace per Q10: no Replace on any slot. Test: "shows the flat-slot panel titled by the rig…".
- [x] The entity editor's gallery shows the same panel for a layered slot. Per Q11: name bar plus Edit Layers under it. Test: "offers Edit Layers under the name bar…".
- [x] The slot's card and panel title is the Layered Image's name. Unit test "takes the rig's name…" and the panel test.
- [x] The size line gives the Layer count and a total that counts a part shared by two Layers once. Unit and panel tests, shared part in both.
- [x] Edit Layers opens the full-screen editor on desktop and the Layer panel on mobile, on that Layered Image. Tests "opens the full-screen editor on desktop…" and "opens the Layer panel in a dialog on mobile".
- [x] Replace offers Layered Images; Remove unlinks only this slot and the Layered Image stays in the Media List. Remove: test "removes the rig from this slot only…". Choose after Remove lists Layered Images: the existing "lists the Layered Image in Choose…" test.
- [x] Download saves the flattened outside-play picture. Test "downloads the flattened outside-play picture, lossless…" (flatten mocked: jsdom has no canvas).
- [x] Each new guard fails with its bug put back. 9 mutations (dedupe, rig name, stacking, row button, host gate, gallery button, lossless, file name, mobile), each turned its test red.
- [x] Frames: `.scratch/frames/layered-slot-panel-desktop.png` (1440 wide) and `.scratch/frames/layered-slot-panel-mobile.png` (390 wide), dark theme, Roxanne-like rig selected in Group by Entity. Sunmeadow's Roxanne Bare, Simple mode, via Playwright.

For you: open Sunmeadow's Roxanne in Group by Entity and check that editing her Layered Image from her gallery feels as direct as editing a flat image.

## Landed

**Not verified**
- None.

**For you**
- For you: open Sunmeadow's Roxanne in Group by Entity and check that editing her Layered Image from her gallery feels as direct as editing a flat image.
- Look at the Edit Layers dialog on a real phone: the mobile dialog is new (`.scratch/layered-images-media-tab-01/frames/layered-slot-panel-mobile.png` shows the slot panel only).
- Location and item image fields now show Edit Layers too (same component); ticket 02 adds their guards and docs.
