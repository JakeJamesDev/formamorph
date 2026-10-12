# 06: Gallery image becomes an object

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a type change with a wide blast radius (eight writers, three codecs) plus a migration that must be idempotent at every import boundary. Export shape changes for worlds and cards.

Parent: [Image Visibility Rules spec](../spec.md)

## What to build

Each gallery image can carry Requirement Rows (Q11). Nothing evaluates them yet; that is ticket 07. This ticket changes the shape and proves every reader and writer survives.

- The gallery element becomes `{ data, requires? }`. `requires` is the same rows type trait gates use. The gallery reader returns objects; a sibling helper returns data strings for callers that only paint. The primary helper still returns slot 0's data.
- Migration wraps every string in place, idempotent, at every boundary that wraps Requirement Rows today: world migration, the character card codec and the library read.
- Every writer walks the object: image optim core, the remote-image embedder, the WebP fix, the downscale prompt, the MainMenu import, the ST persona import, the Tavern card import and the backup index. The compile error list is the checklist; the ticket's comments list every site touched.
- Character card: `extraImages` elements become objects. Slot 0 travels as the card pixels, so the card JSON gains a field for slot 0's rows. The codec round-trips both.
- Editor reorder and delete carry each image's rule with it.

## Acceptance criteria

- [ ] A world with string images loads, migrates once and is byte-stable on a second migration.
- [ ] A card with string `extraImages` imports; a card with object elements and a slot 0 rule round-trips both.
- [ ] Each listed writer has a test over an object gallery; downscale and WebP output keep the rule.
- [ ] Reorder and delete in the gallery editor keep each rule on its image.
- [ ] The library grid, listing art and card pixels still show slot 0.
- [ ] The landing response carries the export-shape reminder for world and card JSON.
- [ ] Changelog fragment written. Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments

**Sites touched (2026-10-12).** Spec-session rulings Q29 (image rules travel the four card paths), Q30 (`primaryImageRequires`), Q31 (replace keeps the slot's rule).

| Site | Change |
|---|---|
| `types/world.ts` | `GalleryImage { data, requires? }`; `Entity.images` holds it |
| `lib/entityImages.ts` | `entityImages` returns objects and wraps strings; `entityImageData` for painters; `primaryImage` is slot 0's data; `migrateEntityImages` wraps in place; `hasImageRules`, `mapImageRules` |
| Migration boundaries | `migrateWorld` (through `migrateEntityGalleries`), the card codec (`cardImage`), the library read (`EntityStorageService.getEntityData`) |
| Card codec, `lib/entityFile.ts` | `extraImages` objects, `primaryImageRequires`; `parseEntityCardData(raw, pixels?)` puts the card pixels first with slot 0's rule |
| Card travel | `portableImages` names, `bindOwnedTraits` binds, `remintOwnedTraits` re-points, `comparableOwnedTraits` and `contentMatchesSource` compare |
| Writers | `imageOptimCore` (world and entity), `embedRemoteImages`, `testBench/imageWebpFix`, the `image-mislabeled` fix, `useDownscalePrompt`, `MainMenu` import, `stPersonaImport`, `tavernCard`, Tavern PNG import, `backupIndex` (through the optim core) |
| Painters | `EntityVisual`, `imageSlots`, Test Bench image slots, `promptImagesBatch` callers read `entityImageData` |
| Editor | `ImageTagsField` holds `GalleryImage[]`: reorder moves objects, delete drops the rule, replace keeps it; `LocationManager` wraps its one background |
| Other | Authoring Tour example image; `docs/WorldFormat.md` gallery image table |
