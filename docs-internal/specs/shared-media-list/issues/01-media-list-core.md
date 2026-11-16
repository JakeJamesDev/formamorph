# 01: Media List Core

Status: ready-for-agent
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

- [ ] A world with no Media List and only embedded media reads the same through every helper as it did before.
- [ ] The resolver returns the entry's data for an id, the data itself for an embedded value, and nothing for a missing id.
- [ ] Placing the same file twice returns one id and adds one entry.
- [ ] Placing a file whose name is taken adds `name (2)`.
- [ ] Names drop the extension; a missing file name gives the subject plus the next free number.
- [ ] Resolution gives back the embedded file with its entry's name.
- [ ] The compare reads an embedded file and an id holding the same bytes as equal, and different bytes as different. The test fails if the compare uses raw strings.
- [ ] The usage index lists every field that links an entry.

> ⚠️ Export shape: World JSON gains an optional Media List and optional id-form links. Remind the user.
