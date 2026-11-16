# 03: Galleries on the List

Status: ready-for-agent
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The first flip. Entity and location galleries move into the Media List when a world loads. Every reader of those galleries goes through ticket 01's resolver, so an old world looks exactly the same in the editor, in play, on the map and in exports, while its JSON now holds the list.

- An idempotent `migrateWorld` step moves entity and location gallery images into the list. It merges byte-identical files (Q14) and names entries with the subject fallback (Q10). Visibility rules stay on each link (Q11).
- Every reader of entity or location galleries resolves through the resolver: editor slots and tiles, play panels and the entity view, the location backdrop, the map, the Media tab, the Test Bench image findings, Formaquestion's world reading, and the World Editor's image optimize pass.
- Editing in the current gallery UI still works: an upload places into the list and links it. Ticket 04 replaces the empty-slot UI.
- Linked (http) images keep their badges and offline cache.
- Saves load unchanged.
- From ticket 01's landing: some readers pass no list yet, so a link reads empty there. Thread the list into the Media tab's entity and location galleries, and keep links (not resolved pictures) on gallery write-backs such as remote-image embedding and the image fixes. Body backdrop readers are ticket 05's. Migration hashes before calling `placeMedia`, which throws on embedded data with no hash.

## Acceptance criteria

- [ ] A bundled world with galleries migrates on load; running the migration again changes nothing.
- [ ] Two entities with the same picture end up linking one entry.
- [ ] Each entity keeps its Visibility rules per image after the migration, and play shows the same image as before for the same state.
- [ ] Uploading into a gallery adds a named entry and links it.
- [ ] Removing a gallery image unlinks it and leaves the entry.
- [ ] Optimize Images re-encodes a shared entry once.
- [ ] Every flow from ticket 02 still round-trips a migrated world's entity.
- [ ] Ticket 02 left this wiring untested, and a migrated world is its first real run, so check each here: saving the world writes an owned linked copy back to the library with embedded named images; the update review dialog shows no image change for an unchanged source; card export from the World Editor carries the images (a read of the card JSON is enough where the WebP encode can't run).
- [ ] Frames of the entity editor gallery and the in-play entity view on a migrated bundled world, dark theme, 1440 wide: `.scratch/frames/gallery-editor.png`, `.scratch/frames/gallery-play.png`.

For you: open two or three of your own worlds and check their portraits and location backdrops look right.

> ⚠️ Export shape: world JSON now writes the Media List, and gallery links hold ids. Remind the user.
