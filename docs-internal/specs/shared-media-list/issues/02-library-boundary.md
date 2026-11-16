# 02: Library Boundary

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Library entities keep embedded media; worlds will hold ids (Q18). Every flow that crosses between them runs ticket 01's placement or resolution, beside the existing Avatar placement. Comparison of a world copy with its library source uses hash tokens. This lands before any world holds ids, so ids never leak into a library record.

- Into a world: Add from Library (the add commit), library sync, reviewed updates, Replace Source, card import into a world, and Enter World cast additions. Each embedded file is placed into the world's list and its field rewritten to the id.
- Out of a world: Save to Library, owned write-back, card export, and entity publish. Each id is resolved to an embedded file carrying its entry's name.
- Embedded gallery images gain an optional `name`, so a round trip keeps names.
- The source comparison and the update review's diff compare media by hash token.

## Acceptance criteria

- [ ] On today's embedded worlds, every flow above gives the same result as before.
- [ ] With an id-form world fixture, Add from Library places the entity's images into the list, reusing an entry with the same file, and the entity holds ids.
- [ ] With an id-form world fixture, Save to Library stores embedded images with their names and no ids.
- [ ] A linked copy holding ids and its embedded source with the same files read unchanged: no update prompt and no write-back. The test fails if media compares by bytes.
- [ ] A library update with a changed portrait adds the new file to the world's list and relinks the copy.
- [ ] A card exported from an id-form entity opens with its images and names; one imported into a world places them.
- [ ] An entity published from an id-form world carries embedded media.

> ⚠️ Export shape: card and library JSON gain an optional `name` on embedded gallery images. Remind the user.
