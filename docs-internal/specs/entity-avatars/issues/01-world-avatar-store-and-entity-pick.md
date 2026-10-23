# 01: World Avatar Store and Entity Pick

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: new world and entity fields plus one editor section and one dropdown, on existing patterns. It owns the store and pick types every later ticket imports.

## What to build

An author manages a store of Avatars in the World Overview (spec: World store, Q2, Q3, Q17). Each Avatar has a generated id, an embedded file and a display name. The author adds one by file upload or by copying one from their Avatar library, renames it, and deletes it. A delete names the entities that use it and sets them to none (Q16). A world entity gets an Avatar dropdown: None, User's Default, then each store Avatar by name, with None for new entities (Q11). The field name must not read as Profile Image. The stat morph-binding picker lists the morphs of every store Avatar. The old **3D Player Avatar** checkbox and uploader stay until ticket 03.

## Acceptance criteria

- [x] The world type carries the Avatar store (id to embedded file plus display name). The entity type carries an optional pick: none, user's default, or a store id. Absent means none. (`WorldOverview.vrmStore`, `Entity.vrmPick`; tsc green.)
- [x] Upload adds a store Avatar with a new UUID-helper id; a library copy embeds the bytes, never a library id. (worldAvatars bench: "adds an uploaded file…", "copies a library Avatar…", "keeps both of two uploads…".)
- [x] Rename changes only the store entry; entities keep their pick. (Bench: "renames only the store entry on blur…".)
- [x] Delete shows a confirmation that names every entity using the Avatar; on confirm those picks become none. (Bench: "names every entity…", cancel and one-step undo cases; mutation-tested.)
- [x] The entity dropdown lists None, User's Default and each store Avatar; a new entity starts on None. (Bench dropdown cases; live preview read "None" on a new entity.)
- [x] The morph-binding picker lists morphs from every store Avatar. (`useBodyMorphNames.test.ts`; mutation-tested.)
- [x] worldEditorBench tests cover add (both ways), rename, dropdown options and default, and delete with the named confirmation. (`WorldEditor.worldAvatars.test.tsx`, 15 cases.)
- [x] Dev routes open the World Overview Avatar section and the delete confirmation. (`#dev?modal=deleteWorldAvatar&tab=overview&mode=advanced`; DOM read showed the canned confirmation.)
- [x] Frames `.scratch/frames/01-store.png` and `.scratch/frames/01-dropdown.png`, light and dark, 1280 wide. (Plus `-dark` twins and `01-delete.png`; 1280×900 viewport, saved at the pane's 800 px scale.)
- [x] Export-shape reminder in the landing: the world gains the store and the entity pick.

## Landed

**Not verified**
- Copy From Library in the live preview: the preview's port has an empty model library, so the frame shows it disabled. The bench test covers the copy.

**For you**
- For you: the World Overview Avatar section's layout and wording, in the editor's World Overview. See `.scratch/entity-avatars-01/frames/01-store.png` and `01-store-dark.png`.
- The entity Avatar dropdown under 3D Model: `.scratch/entity-avatars-01/frames/01-dropdown.png` and `01-dropdown-dark.png`.
- History rows for add and rename read "Avatars" without the Avatar's name. Say if you want named labels.
