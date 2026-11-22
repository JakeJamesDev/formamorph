# 04: Delete From World Takes Unshared Parts

Status: ready-for-agent
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

- [ ] Deleting a Layered Image removes its unshared parts from the Media List.
- [ ] A part shared with another Layered Image, or linked by a field, stays.
- [ ] The confirm lists every part it removes by name.
- [ ] One Undo restores the Layered Image, its parts and every link to them.
- [ ] Each new guard fails with its bug put back.
