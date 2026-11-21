# 07: Outside Play and Portability

Status: ready-for-human
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A Layered Image looks right outside play and travels whole. The spec covers this in Q5, Q12 and its Portability section.

- **Outside play.** Extend ticket 02's `outsidePlayLayered` helper (each Layer's first Variant, rules and settings ignored) rather than building a second one. The library grid, listings, setup and slot thumbnails use it.
- **Flatten.** One function, owned here, draws a resolved stack to one bitmap at the canvas size (Q23, Q29) with opacity, tint and blend mode. Ticket 09 reuses it. Tint must match ticket 04's live tint: a per-channel scale in sRGB with alpha untouched (an SVG color matrix in play), not a masked multiply.
- **Portable form.** Library entities and publish embed the layered entry, with its Variant images embedded and named. They convert at the boundary, as the Shared Media List does. Import merges byte-identical images.
- **Character cards.** The card PNG pixels are the flattened outside-play picture. The card's Formamorph data carries the full rig.
- **Docs.** The Library page says a Layered Image travels whole and cards show the default look.

## Acceptance criteria

- [x] Round-trip tests (library, publish, card) keep every Layer, Variant name and rule, and merge duplicate images. `portableLayered.test.ts` (18 tests): library save and re-add, rig reuse (the world's name wins, Q37), migration, card `primaryLayered` and `extraImages`, publish, Variant rule naming and binding; 22 mutants, all killed.
- [x] A card's pixels equal the flattened outside-play picture, including tint and blend. `entityFile.export.test.ts` "draws the card from the flattened outside-play picture, tint and blend included" (expected pixel worked by hand); compositing math in `layeredFlatten.test.ts`.
- [x] The library grid shows the first-Variant picture. `EntityStorageService.test.ts` (metadata picture) and `WorldCardFace.test.tsx` (the tile draws the stack in both layouts).
- [x] Changelog fragment written. `docs-internal/changelog.d/layered-images-07.md`.

⚠️ Export shape: library entities, publish payloads and character cards embed the rig.

## Landed

**Not verified**
- Flatten against the browser's own drawing. The math follows `PictureImg`'s CSS (tint matrix, opacity, `mix-blend-mode`, `plus-lighter`) and is tested over plain RGBA. The canvas reader and the WebP writer (`CANVAS_IO`) never ran in a test, since jsdom has no canvas.
- No card was exported, published or imported in a running app.
- AI images (Q37 item 6): today only player-attached files become image parts, so nothing changed.

**For you**
- Export the card of a character whose first image is a Layered Image with a tint and a Multiply Layer. Compare the card's picture with the Media tab preview at Default Look (Library → entity → Export).
- Import that card into another world that already holds one of its images. The Media tab should show one copy of that image and the full rig.
- Look at the Entities tab tile and the persona picker for that character: each shows the default look.
