# 🎨 Art Harness

Gives a bundled world its art through the app's own image path, so an art ticket runs one command instead of clicking **Generate with AI** thirty times.

## ⚠️ The window rule

Generation holds the GPU, and the GPU is shared with the machine's owner.

- Run with `--live` only inside a GPU window the owner has agreed to.
- Without `--live`, the harness is a dry run: it lists every image it would make and makes nothing.
- Keep the InvokeAI server running on port 9090 for the whole run, with the Invoke GUI closed.

## What one run does

1. Picks the images: by default, slot 0 for every location and entity that has no image.
2. Builds each request the way the editor does: the art-direction line first, then the item's `imageTags`.
3. Generates through the app's InvokeAI provider with the Illustrious Nova Kemono XL 8.0 preset (euler_a, 35 steps, cfg 4, Face Fix off unless `--face-fix`).
4. Encodes each image to lossless WebP with the app's encoder, in Chromium on a dev build.
5. Writes each image into the world file by item id as it lands. Every other byte stays the same.
6. Draws a contact sheet of every image the world now holds at `.scratch/frames/<world>-sheet.png`, each labeled `Name#slot`.
7. Prints the world file's size before and after, and any Test Bench image findings.

| Kind | Size | Lands in |
|---|---|---|
| Location backdrop | 1216×832 | the location's gallery |
| Entity portrait | 832×1216 | the entity's gallery |
| Map image | 1216×832 | the overview's Map Background, framed over the locations at full opacity |

## Usage

```bash
npx vite-node testing/art-harness/art-harness.cli.ts -- --world emberwatch --style "<art-direction line>"
```

| Flag | What it does |
|---|---|
| `--world <id\|path.json>` | The world: a bundled id, or a path to a world file. Required. |
| `--style "<line>"` | The world's art-direction line. Required unless `--replay`. |
| `--live` | Make the images. Without it, the run is a dry run. |
| `--missing` | Slot 0 for every item with no image. The default unless `--redo` or `--variant` is given. |
| `--redo "Name,Name#1,map"` | Make these slots again with new seeds. An id works in place of a name. Slot 0 of an empty gallery is filled. |
| `--variant "Name=extra tags"` | Add a new slot: the item's tags plus the extra tags. Repeat the flag for more. Set its Visibility rule in the editor. |
| `--negative "<tags>"` | Add these tags after the pinned negative prompt for every image in the run. The run log keeps them for `--replay`. |
| `--face-fix` | Turn on the provider's Face Fix pass for every image in the run. With `--replay`, it adds the pass and keeps each seed and prompt. The run log keeps it. |
| `--map "<map tags>"` | The map's tags. Makes the first map image when the world has none. A map redo or variant needs it too. |
| `--replay <run log>` | Make a log's images again at their stored seeds and prompts, into the same slots. |
| `--sheet` | Draw the contact sheet only. Makes nothing and needs no GPU. |
| `--out <path.json>` | Write the result here instead of over the input file. |
| `--endpoint <url>` | InvokeAI's address. Default `http://localhost:9090`. |
| `--port <n>` | The dev server's port. Default: a free one. Never 5180. |

## Stopping and resuming

- Each image is written to the world file as it lands. A stopped run keeps every image it finished.
- When the `--out` file exists, the run continues from it instead of the input file. Run the same command again to make what is still missing.
- Each live run writes `.scratch/art-harness/<world>-<time>.json` after every image, with each slot, seed and exact provider request. Pass it to `--replay` to make those images again.
- Before the GPU starts, the run tries every write on placeholder data. A slot that cannot be written stops the run there.

> 💡 The world file must be two-space JSON with one trailing newline, the form every bundled world is stored in. The harness refuses any other form, because a write would reformat the whole file.

## Tests

`artHarness.test.ts` covers the pure parts: request composition per kind, picking images, the id-keyed write, and the sheet layout. Generation itself has no unit test.
