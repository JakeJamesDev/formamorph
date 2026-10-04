# 07: Image store and rig editor

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The player edits the rig on a Mascot tab.

- A new IndexedDB store on the shared helper holds player images by id, as the model store does: add returns an id, get returns the blob, delete removes one. Not a cache; nothing drops it. Bundled assets never enter it.
- A fifth tab, Mascot, after Tools, with a Surface and a dev-route entry. The switch row moves here from the General tab. Rows: the switch; the rig preview; the base image; the layer list; Reset. Picks, Voice and Mask come in tickets 08 and 09.
- The layer list is reorderable; each row shows name, kind (expression or state), switch and its overlays; expanding shows the overlay list, itself reorderable, with add and remove.
- Image upload reuses the existing upload control; a file goes to the store; a pasted link is refused.
- Removing an overlay, a layer or the base deletes images no other layer references. Reset restores the default rig and deletes the player's images.
- The preview and the window turn stored images into object URLs and revoke them on unmount.

Spec: Q2, Q11, Q13; Implementation → Mascot image store, Mascot tab.

Recommended model rationale: a new store plus a nested reorderable editor, with object URL lifetimes to get right.

## Acceptance criteria

- [ ] The store adds, gets and deletes, and a reload keeps the blob.
- [ ] The tab lists layers in order with kind and switch; reorder, add, remove and expand work for layers and overlays; the preview follows.
- [ ] An upload lands in the store and the rig holds its id; a link is refused.
- [ ] Removing the last reference deletes the image; Reset restores the default and empties the store.
- [ ] The surface registry scan covers the tab; the dev route opens it.
- [ ] No object URL survives an unmount; the suite's exit code is the check.
- [ ] The four gates are green.
