# 02: Library Boundary

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Library entities keep embedded media; worlds will hold ids (Q18). Every flow that crosses between them runs ticket 01's placement or resolution, beside the existing Avatar placement. Comparison of a world copy with its library source uses hash tokens. This lands before any world holds ids, so ids never leak into a library record.

- Into a world: Add from Library (the add commit), library sync, reviewed updates, Replace Source, card import into a world, and Enter World cast additions. Each embedded file is placed into the world's list and its field rewritten to the id.
- Out of a world: Save to Library, owned write-back, card export, and entity publish. Each id is resolved to an embedded file carrying its entry's name.
- Embedded gallery images gain an optional `name`, so a round trip keeps names.
- The source comparison and the update review's diff compare media by hash token.
- From ticket 01's landing: `placeMedia` needs precomputed hashes and throws on embedded data it has none for, so each flow hashes before placing and writes the returned list back to the world. `mediaToken` ignores entry kind, so compare per field.

## Acceptance criteria

- [x] On today's embedded worlds, every flow above gives the same result as before. Placement is gated on an existing Media List (Q26): "leaves a world without a Media List embedded" and "keeps pictures embedded in a world without one"; the existing linked-content, write-back, update and bundle suites pass unchanged in the affected-tests gate.
- [x] With an id-form world fixture, Add from Library places the entity's images into the list, reusing an entry with the same file, and the entity holds ids. `useLibraryLinking.media.test.tsx` › "places its pictures, reusing the entry…" and "two copies of one file share an entry".
- [x] With an id-form world fixture, Save to Library stores embedded images with their names and no ids. Hook test through real (fake-IndexedDB) storage, plus `toLibraryItem` in `libraryMedia.test.ts`.
- [x] A linked copy holding ids and its embedded source with the same files read unchanged: no update prompt and no write-back. The test fails if media compares by bytes. The source holds the same bytes under another MIME string; `contentMatchesSource`, `diffContent`, `planWriteBack` and `planOwnedWriteBack` all read unchanged. The mutations to a byte compare go red.
- [x] A library update with a changed portrait adds the new file to the world's list and relinks the copy. `applyUpdate` live path ("Check for Updates"), the library sync hook test, and Replace Source through `applyRepair`.
- [x] A card exported from an id-form entity opens with its images and names; one imported into a world places them. `buildEntityCardData` → `parseEntityCardData` round trip with `primaryImageName` (Q28), then `beginAdd` places the parsed card with names kept.
- [x] An entity published from an id-form world carries embedded media. Publish reads the library item (Q29); `entityPublishPayload(toLibraryItem(...))` holds no `mediaId`.

> ⚠️ Export shape: card and library JSON gain an optional `name` on embedded gallery images. Remind the user.

## Landed

**Not verified** (wiring with no test of its own; each calls a helper that is tested and mutation-checked):
- Card export from the World Editor passes the world's list to `exportEntityCard`. The WebP encode needs a canvas that jsdom lacks.
- `GameDataContext` passes `worldOverview.mediaList` to the save's write-back. `planOwnedWriteBack` itself is tested.
- The update review dialog's diff lookup, `worldBundleRun`'s lookups, and the Test Bench Replace Source hashing.
- A file re-import (`reviewImportedFile`) now compares images without names (Q30).
- No frames: no world holds a Media List until ticket 03, so nothing renders differently.

**For you:**
- Nothing to judge in play yet. Ticket 03's migration is the first change a player can see.
