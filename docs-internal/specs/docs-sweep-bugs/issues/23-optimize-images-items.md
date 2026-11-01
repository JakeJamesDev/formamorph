# 23: Optimize Images Scans Item Images

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: items join the scan, the re-encode write and the apply step, and each has its own shape.

## What to build

**Optimize Images** never scans item images: its image list takes the overview, entities, locations, dictionaries and groups, with no items. Confirmed in source, not run. Ruling Q19: item images join the scan and the apply step, inside the same **Optimize Images** history Step. An item copy's image, if it has its own, follows the same rule.

Spec: Q19.

## Acceptance criteria

- [x] A World Editor optimize test with an oversized item image fails today (the old image stays), then passes with the re-encoded image: `WorldEditor.optimizeItems.test.tsx` runs the real scan, dialog, walk and write with only the encoder stubbed. Removing the write-back or the list entry turns it red
- [x] One undo reverts the item change with the rest of the run (test): the same test, Ctrl+Z restores the item image and the thumbnail. `WorldEditor.optimize.test.tsx` fails when the `Optimize Images` batch is removed
- [x] The scan's count includes item images (test): the dialog says "2 images larger than recommended", and `mediaIndex.test.ts` counts the item under the entity cap
- [x] The World-Editor-Media sentence on what Optimize Images changes names item images; the docs tests are green
- [x] A changelog fragment under Minor / Fixed / 👤: replaced by the spec session's ruling, `Major / Added / 👤 / Inventory`. Items are unreleased, and the fragment README's rule wins over this bucket line

## Landed

- Item images join `worldImageItems`, the one shared list. Optimize Images, import, export, backup restore, ship-time Downscale and the `world-oversized-images` rule all gain them, and a flagged item opens Items.
- The item cap is `IMAGE_CAPS.entity`, the cap `EntityImageWidget` uses (`src/managers/EntityFields.tsx:362`).
- The `image-not-webp` and `image-mislabeled` Fixes write item images, and an item's row clears after each Fix.
- The item-copy clause needs no code: `ItemCopy` has no image field.
- This ticket rewrites no bundled world file. Ship-time Downscale picks up item images on its next run. Emberwatch has 32 items, and none has an image today.
- No export-shape change: `items` already exists in the world shape.
- Mutation runs: 7 of 7 killed by the expected tests. The first gate run failed typecheck on item fixtures; the rerun on the final code exited 0.
- Coverage (statements, branches): `imageOptimCore` 99, 86 · `mediaIndex` 100, 96 · `mediaParents` 98, 82 · `imageWebpFix` 98, 91 · `useTestBench` 84, 65 · `useMediaItemActions` 11, 100.

**Not verified:** the Browser pane. The Media tab has no visual change, so the tests carry the editor flow. The `item` binding in `useMediaItemActions` has no test, because no card can reach it.

**For you:**

- Item images have no gallery card. The spec session ruled this: they join only the optimize list.
- Map Background and dictionary cover images keep a Fix gap: their `image-not-webp` and `image-mislabeled` rows do not clear after Fix. Not fixed here.
- A corrupt WebP can stall the scan. `webpImageChunk` in `src/lib/imageBytes.ts` reads a chunk size as a signed number. A negative size sends the walk far below zero, and a 1,200-character bad payload did not finish in 180 s. The scan runs on the main thread, so the editor would freeze. This ticket's test fixtures avoid those bytes, and the code is not fixed here.
