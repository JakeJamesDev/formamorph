# 13: Store Row Preview, Export and Named History

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: reuse the old uploader's preview and export on each store row, and pass the Avatar's name into the history labels.

## What to build

Each Avatar row in the World Overview store gets a 3D preview and an **Export** button, as the old Player Avatar uploader had (spec: Post-Close Rulings, Q29). The undo history names the Avatar on add, rename and delete ("Add Avatar: Fen Walker"), instead of reading "Avatars".

## Acceptance criteria

- [x] Each store row can open a 3D preview of its Avatar and export its file under its display name. (tests "a store row preview": panel heading, byte-equal export as `Fen Walker.vrm`, `Reed.glb`)
- [x] History rows for add, rename and delete name the Avatar. (tests "the store history labels": upload, library copy, rename, delete)
- [x] worldEditorBench tests cover export and the history labels. (`WorldEditor.worldAvatars.test.tsx`; export name and rename label mutation-tested red)
- [x] Frame `.scratch/frames/13-store-row.png`, light and dark, 1280 wide. (headless Playwright on the worktree server; dark is `13-store-row-dark.png`)
- [x] Changelog fragment.

For you: the store row layout with the preview and Export, in the editor's World Overview.

## Landed

**Not verified**
- The 3D model inside the opened preview was not framed: jsdom stubs the viewer and the Browser pane was hidden.

**For you**
- For you: the store row layout with the preview and Export, in the editor's World Overview. Frames: `.scratch/entity-avatars-13/frames/13-store-row.png`, `.scratch/entity-avatars-13/frames/13-store-row-dark.png`.
- Open **Preview** on a store Avatar and check the 3D model and **Export** in the details panel.
