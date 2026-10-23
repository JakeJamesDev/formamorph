# 07: Avatar Export, Import and Publish Size

Status: done
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: embed and dedupe on two file paths, plus two size checks against known server limits.

## What to build

An exported character card or entity listing carries the library Avatar its author picked, embedded in the file (spec: Entity pick; Q23 reopened). Picks of none or user's default export as they are. Importing an entity file that carries an Avatar adds it to the Avatar library, reusing an existing record with the same content hash, and rewrites the pick to that library id. Publishing an entity listing checks its size, Avatar included, against the server's 25 MB entity limit. Publishing a world checks its store against the 100 MB world limit. Both checks run before upload.

## Acceptance criteria

- [x] A card export of an entity with a library Avatar pick contains the Avatar file; none and user's default export unchanged. `entityVrmCarry.test.ts` › character card export (library, world store, none/default, missing).
- [x] Importing that card twice adds one library record (same hash) and points both picks at it. `entityVrmCarry.test.ts` › character card import; listing download and the card-names-a-listing path too.
- [x] Entity and world publish refuse an over-limit upload before sending, with a message that names the size. `entityVrmCarry.test.ts` › publish size: a 20 MB Avatar refuses as "Entity is 26.7 MB"; the world case runs at a lowered limit.
- [x] Tests cover export, import with dedupe, and both size checks. 12 tests; every guard mutation-tested; module at 100% lines.
- [x] Changelog fragment. `docs-internal/changelog.d/entity-avatars-07.md`.
- [ ] Export-shape reminder in the landing: character cards and entity listings carry the pick and the embedded Avatar.

## Landed

**Not verified**
- Export-shape reminder: lands in the landing reply, not in code.
- The world size test lowers the limit to 2 KB instead of building a 100 MB store. The measure is the same code path.
- The publish and card-export call sites (Main Menu, linked sources, Entity Editor, World Editor, device download) and the `useLibraryDownload` adoption are checked by reading, not by a test.

**For you**
- Export a library entity with an Avatar pick as a card, then import it on a clean profile: the Avatar shows in the library once, and the entity picks it.
- Publish an entity whose Avatar is large: the refusal names the size before any upload.
- Importing a card adds its Avatar to the library even when you cancel the World Editor's import review.
