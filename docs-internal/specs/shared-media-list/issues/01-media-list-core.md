# 01: Media List Core

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The expand step. The World type gains the Media List, and media fields learn to hold either an embedded file or a media id. Pure functions that later tickets build on. Nothing writes ids yet, so every existing world behaves exactly as before. This ticket owns every shared primitive below; later tickets import them.

- The Media List and Media Entry types (spec, Implementation Decisions): `{ id, name, kind: 'image' | 'sound', data }`, plus an optional content hash. A gallery entry accepts `{ mediaId, requires? }` beside today's `{ data, requires? }`. The single media fields accept a media id too.
- Name rules: drop the extension (Q9), the subject-plus-number fallback (Q10), and uniqueness with a numeric suffix, compared trimmed and case-insensitive (Q5).
- Content hash for embedded data, using the hasher the Avatar store uses.
- One resolver: a link (id or embedded) and a world in, displayable media out. An id with no entry resolves to nothing. The existing gallery helpers (entity, location and map image readers) route through it.
- Placement: an embedded file and a world in, the reused or new entry id out, with the world's list updated. It reuses the entry whose hash matches (Q14, Q18).
- Resolution: a world field holding ids, turned back into embedded files with their names (Q18).
- The hash-token compare for media, the way Avatar picks compare.
- A usage index: for each entry, every entity, location, item, map, backdrop and world field that links it.

## Acceptance criteria

- [x] A world with no Media List and only embedded media reads the same through every helper as it did before. Existing `entityImages`, `locationImages`, `mapBackground`, `mediaIndex` suites and the affected-tests gate pass unchanged.
- [x] The resolver returns the entry's data for an id, the data itself for an embedded value, and nothing for a missing id. `mediaList.test.ts` › resolveMedia.
- [x] Placing the same file twice returns one id and adds one entry. `placeMedia` › "reuses the entry holding the same bytes".
- [x] Placing a file whose name is taken adds `name (2)`. `placeMedia` › "adds `name (2)`".
- [x] Names drop the extension; a missing file name gives the subject plus the next free number. `names` suite (Q9, Q10).
- [x] Resolution gives back the embedded file with its entry's name. `embedGallery` test; `resolveMedia` names sounds.
- [x] The compare reads an embedded file and an id holding the same bytes as equal, and different bytes as different. The test fails if the compare uses raw strings. `mediaToken` test; mutation to a raw-string compare goes red.
- [x] The usage index lists every field that links an entry. `mediaUsage.test.ts`.

> ⚠️ Export shape: World JSON gains an optional Media List and optional id-form links. Remind the user.

## Landed

**Not verified:** nothing; every criterion has a test, and each guard was mutation-tested.

**For you:**
- Nothing to judge in play: ticket 01 writes no ids, so no world looks or behaves differently.

**For later tickets:**
- `placeMedia` takes the list and precomputed `mediaHashes`, and throws on embedded data it has no hash for. Callers write the returned list back to `worldOverview.mediaList`.
- Readers with no list in scope pass none, so a link reads as empty there: the body backdrop readers, `mediaIndex` entity and location galleries, and gallery write-backs such as `embedRemoteImages` and the image fixes, which rebuild `images` from resolved pictures. Tickets 03 and 05 thread the list and keep links on write-back.
- `mediaToken` ignores entry kind; compares are field-scoped today.
