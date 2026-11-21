# 13: Lossless WebP for Exported Cards

Status: ready-for-agent
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

- [ ] Card export asks the writer for lossless WebP, and the publish thumbnail asks for lossy 0.92. Covered by a test through the `RasterIO` seam, which goes red if both paths share one setting.
- [ ] A card exported in a running app holds a picture whose pixels equal the flatten's output. Record the method and the file size against a lossy export of the same character in the Landed section.
- [ ] Changelog: none if Layered Images is still unreleased.

For you: export a card of a character with a tinted Layered Image and compare it with the Media tab preview at Default Look.
