# 13: Lossless WebP for Exported Cards

Status: ready-for-human
Blocked by: none
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An exported card keeps a flattened Layered Image exact. The spec covers this in Q42.

- Today the flatten writes lossy WebP at 0.92 for every use (`CANVAS_IO.write` in `src/lib/layeredFlatten.ts`).
- Card export (`exportEntityCard` in `src/lib/entityFile.ts`) writes the flattened picture as lossless WebP. In Chromium, `canvas.toDataURL('image/webp', 1)` writes lossless WebP: a round trip on a 768 × 1152 test picture changed 0 pixel values (390 KB, against 77 KB lossy and 830 KB PNG).
- The publish thumbnail (`entityPublishPayload` in `src/lib/publishPayload.ts`) stays lossy WebP at 0.92.
- The card path must not re-encode the lossless file to lossy afterwards.

## Acceptance criteria

- [x] Card export asks the writer for lossless WebP, and the publish thumbnail asks for lossy 0.92. Covered by a test through the `RasterIO` seam, which goes red if both paths share one setting. (`entityFile.export.test.ts` expects quality 1; `portableLayered.test.ts` expects `q=0.92`. Reverting the export call to the default turned the export test red.)
- [x] A card exported in a running app holds a picture whose pixels equal the flatten's output. Record the method and the file size against a lossy export of the same character in the Landed section. (See Landed.)
- [x] Changelog: none; Layered Images is unreleased.

For you: export a card of a character with a tinted Layered Image and compare it with the Media tab preview at Default Look.

## Landed

Method: in the ticket's dev server, `flattenLayered` ran on a 384 × 576 two-Layer picture (noisy body, noisy 70% alpha face, orange Multiply tint). The output was read back through `CANVAS_IO.read` and compared with `composeLayers` on the source pixels.

| Quality | Bytes | Channel values that differ | Max error |
|---|---|---|---|
| 1 (card) | 664,176 | 0 | 0 |
| 0.92 (lossy) | 184,281 | 657,005 | 223 |

The test picture is random noise, the worst case for both sizes and error. A real character gives smaller files and a smaller lossy error.

**Not verified**
- A full `exportEntityCard` file from the Media tab UI. The test covers the card path through the seam. The browser check covers the encoder.
- An engine whose canvas cannot encode WebP. The flatten then returns PNG, and the existing card fallback re-encodes it lossy. Chromium (web, Electron, Android) encodes WebP, so none is known.

**For you**
- Export a card of a character with a tinted Layered Image and compare it with the Media tab preview at Default Look.
