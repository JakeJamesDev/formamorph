# 04: Delete From World Takes Unshared Parts

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

**Delete From World** on a Layered Image also removes each part image that nothing else uses (spec Q8). It reads the existing use data; it does not build a part-only helper (ticket 03 owns that rule for the groupings).

- **Plan.** A part whose only uses are this Layered Image's Variants is removed. A part another Layered Image uses, or any field links, stays.
- **Confirm.** The confirm names each part it removes, alongside the places that use the Layered Image.
- **Undo.** The delete, parts included, is one undo step that restores everything.
- **Docs.** The World Editor Media page says deleting a Layered Image removes the parts nothing else uses.

## Acceptance criteria

- [x] Deleting a Layered Image removes its unshared parts from the Media List. (LayeredImageEditor.test: "deletes a rig with the images only it uses…")
- [x] A part shared with another Layered Image, or linked by a field, stays. (mediaUsage.test `unsharedParts`: other rig, gallery, cover, map, Body backdrop; plus the component test)
- [x] The confirm lists every part it removes by name. (component test reads `[data-media-parts] li`)
- [x] One Undo restores the Layered Image, its parts and every link to them. (component test: one `undoMediaEdit` deep-equals the world before)
- [x] Each new guard fails with its bug put back. (dropped the field check, the other-rig check, the part cascade, and split the undo group: each went red)

## Landed

**Not verified**

- None.

**For you**

- Open Delete From World on a Layered Image in the Media tab and read the confirm: the second list "It also deletes these images, which only it uses:".
