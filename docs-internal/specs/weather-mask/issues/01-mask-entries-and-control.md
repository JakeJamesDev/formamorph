# 01: Mask Entries and the Weather Mask Control

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An author can attach a mask to a location image by upload, reuse it on another slot, and manage it in the Media tab. The spec covers this in Q1, Q5, Q6, Q12–Q14, Q16 and Q18. Masks have no effect in play yet; ticket 02 draws them.

- **Shape.** The Media List gains the Mask entry kind (id, name, kind, PNG data). A location image slot (embedded, linked or Layered) gains an optional link to a Mask entry by id. This ticket owns both shapes; every later ticket builds on them.
- **Media List consumers.** Every place that switches on entry kind handles Mask: the Media tab, Delete From World, Remove From Slot, the "kept by" index, stored-size totals, export, publish. Image pickers, gallery adds and script media reads never offer a Mask.
- **Weather Mask control.** In Advanced mode, each location image slot shows it. With no mask: Upload, Pick a mask. With a mask: a thumbnail, Replace, Remove. Ticket 03 adds Paint and Edit. Upload stores the file as a new Mask entry, capped by the location image cap of the Downscale Presets. Remove unlinks the slot only. The control names how many images share the linked mask.
- **History.** Linking, replacing and unlinking go through the editor's history, so undo, redo and Reveal Origin cover them.
- **Docs.** The wiki location page and Media tab page document Weather Mask; WorldFormat documents both shape additions.

## Acceptance criteria

- [ ] Uploading a file on a location image slot creates one Mask entry and links it to that slot.
- [ ] Picking a mask lists Mask entries only and links the chosen one; image pickers and gallery adds never list a Mask.
- [ ] Two slots linking one mask both show it, and the control names the shared count.
- [ ] Remove unlinks one slot and keeps the entry; Delete From World on the mask unlinks every slot.
- [ ] The Media tab lists each Mask with its size and the locations that keep it.
- [ ] The control is absent in Simple mode and absent on entity, item and other galleries.
- [ ] Undo and redo restore each link change.
- [ ] A world exported and imported again keeps its masks and links.
