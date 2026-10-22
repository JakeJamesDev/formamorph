# 01: World Avatar Store and Entity Pick

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: new world and entity fields plus one editor section and one dropdown, on existing patterns. It owns the store and pick types every later ticket imports.

## What to build

An author manages a store of Avatars in the World Overview (spec: World store, Q2, Q3, Q17). Each Avatar has a generated id, an embedded file and a display name. The author adds one by file upload or by copying one from their Avatar library, renames it, and deletes it. A delete names the entities that use it and sets them to none (Q16). A world entity gets an Avatar dropdown: None, User's Default, then each store Avatar by name, with None for new entities (Q11). The field name must not read as Profile Image. The stat morph-binding picker lists the morphs of every store Avatar. The old **3D Player Avatar** checkbox and uploader stay until ticket 03.

## Acceptance criteria

- [ ] The world type carries the Avatar store (id to embedded file plus display name). The entity type carries an optional pick: none, user's default, or a store id. Absent means none.
- [ ] Upload adds a store Avatar with a new UUID-helper id; a library copy embeds the bytes, never a library id.
- [ ] Rename changes only the store entry; entities keep their pick.
- [ ] Delete shows a confirmation that names every entity using the Avatar; on confirm those picks become none.
- [ ] The entity dropdown lists None, User's Default and each store Avatar; a new entity starts on None.
- [ ] The morph-binding picker lists morphs from every store Avatar.
- [ ] worldEditorBench tests cover add (both ways), rename, dropdown options and default, and delete with the named confirmation.
- [ ] Dev routes open the World Overview Avatar section and the delete confirmation.
- [ ] Frames `.scratch/frames/01-store.png` and `.scratch/frames/01-dropdown.png`, light and dark, 1280 wide.
- [ ] Export-shape reminder in the landing: the world gains the store and the entity pick.

For you: the World Overview Avatar section's layout and wording, in the editor's World Overview.
