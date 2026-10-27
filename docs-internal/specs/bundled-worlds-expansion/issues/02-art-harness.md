# 02: Art Harness

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q2, Q11, Q16, Q17, Q19, Q21; Implementation Decisions › Generation path, Image kinds, Encoding, Review artifacts)

## What to build

One command that gives a bundled world its art through the app's own image path, so each art ticket runs it instead of clicking Generate thirty times.

- Input: a world id, the world's art-direction line, and options for which items to make: all items without art, a named list to redo, a Visibility variant for a named item with extra tags, and a Map Background image for the map worlds.
- For each item the harness builds the request the way the editor does: the art-direction line as the positive prefix, the item's `imageTags` as the subject, one landscape size for location backdrops and map images and one portrait size for entity portraits. It calls the app's InvokeAI provider with the Q21 model and that model's Invoke defaults as the preset. A seed per item is stored in the run log so an image can be redone exactly.
- Each result is encoded to WebP through the app's own encoder, which needs a browser canvas, so the harness runs that step in Chromium the way the world probe drives the dev build.
- The harness writes each image into the world file by item id, as slot 0 for a first image or as a new slot for a variant, with every other byte of the file preserved. A map image lands under the world overview's Map Background with a default frame and opacity; the art ticket sets the frame in the editor.
- It builds one contact sheet per run, every image labeled with the item's name and slot, under the worktree's frames folder, and prints the world file's size before and after.
- Generation holds the GPU, so the harness never starts a run on its own: the art ticket's session asks the user for a window first.

## Acceptance criteria

- [x] Unit tests cover the pure parts: request composition per item kind, the id-keyed world write that preserves every other field and image, redo and variant selection, and the sheet layout. Generation itself is not unit-tested. (`testing/art-harness/artHarness.test.ts`, 25 tests; 100% lines, 87.8% branches on `artHarness.ts`; 15 mutations, each one red.)
- [x] A dry run on one world lists every item it would make with its size and prompt, and makes nothing. (Emberwatch: 17 images listed, nothing written.)
- [x] One live run in a user-named window makes two images for one world, one backdrop and one portrait, through the provider, stores them as WebP, and the Test Bench image rules pass on the result. The run log records both seeds. (Emberwatch Keep#0 and Albus#0 written to a scratch copy, both lossless WebP (VP8L). The rest of the world is byte-identical. Test Bench image rules: no findings. Both seeds are in one log.)
- [x] The contact sheet for that run is at `.scratch/frames/<world>-sheet.png` with both images labeled. (`.scratch/frames/emberwatch-sheet.png`, read back.)
- [x] The harness has a README beside it that names the flags and the window rule. (`testing/art-harness/README.md`)

## Landed

**Not verified**

- None.

**For you**

- Look over the two test images at `.scratch/bundled-worlds-expansion-02/frames/emberwatch-sheet.png`. They use a provisional art-direction line. The scratch world copy is not committed.
