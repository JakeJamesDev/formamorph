# 13: Store Row Preview, Export and Named History

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: reuse the old uploader's preview and export on each store row, and pass the Avatar's name into the history labels.

## What to build

Each Avatar row in the World Overview store gets a 3D preview and an **Export** button, as the old Player Avatar uploader had (spec: Post-Close Rulings, Q29). The undo history names the Avatar on add, rename and delete ("Add Avatar: Fen Walker"), instead of reading "Avatars".

## Acceptance criteria

- [ ] Each store row can open a 3D preview of its Avatar and export its file under its display name.
- [ ] History rows for add, rename and delete name the Avatar.
- [ ] worldEditorBench tests cover export and the history labels.
- [ ] Frame `.scratch/frames/13-store-row.png`, light and dark, 1280 wide.
- [ ] Changelog fragment.

For you: the store row layout with the preview and Export, in the editor's World Overview.
