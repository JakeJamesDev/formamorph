# 01: Choose an Avatar's Thumbnail Source

Status: ready-for-human
Base: e55d35dd
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [spec.md](../spec.md), rulings Q1–Q10.

## What to build

A player right-clicks an Avatar card in the Model Library and opens a **Thumbnail** submenu with two radio items: **From File** and **Generated**. **From File** shows the file's embedded image and is the default. **Generated** shows Formamorph's rendered head-and-shoulders portrait. The first switch to **Generated** renders the portrait while the card keeps its current image. Later switches in either direction are instant. The choice survives a restart. Publishing sends the chosen image. The `.vrm` file is never changed.

The submenu is hidden for an Avatar whose file has no embedded image. If the render fails, an error toast shows and the choice stays **From File**.

## Acceptance criteria

- [ ] The stored Avatar record has a thumbnail source (`file` or `generated`). An absent value means `file`.
- [ ] `thumbnail` stays the shown image. The grid, metadata listing, and publish payload keep reading it unchanged.
- [ ] Both variants are cached, so only the first switch to **Generated** renders.
- [ ] The metadata listing tells the menu whether the file has an embedded image, without loading the blob.
- [ ] `ensureThumbnail` honors the chosen source. Its early return no longer skips a needed variant.
- [ ] A legacy record whose file has an embedded image treats its stored thumbnail as the file variant.
- [ ] A delete during the render is not undone by the write.
- [ ] A failed render leaves the source on `file`, keeps the shown image, and shows an error toast.
- [ ] The **Thumbnail** submenu follows the **Size** submenu's radio pattern, shows the active item, and is absent when there is no embedded image.
- [ ] A switch updates the Avatar's entry in the grid state directly. The id-keyed backfill effect does not need to rerun.
- [ ] A switch does not touch an existing community listing. The next publish sends the chosen image.
- [ ] Copy says **Avatar**, never "model" or "VRM". The labels read **From File** and **Generated**.
- [ ] Tests: storage service (default, render-once, failure, legacy record, delete race, publish image), context menu (active item, callback, hidden case), and the grid switch handler. Each guard bites when its bug returns.
- [ ] `verify-ui` on the dev-routed Model Library, in both themes.
- [ ] A changelog line under 🚧 In Progress.
- [ ] Four gates green.
