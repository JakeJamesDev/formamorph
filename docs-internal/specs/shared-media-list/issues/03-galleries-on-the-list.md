# 03: Galleries on the List

Status: ready-for-human
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

- [x] A bundled world with galleries migrates on load; running the migration again changes nothing. `mediaGallery.test.ts` › "is idempotent and deterministic"; `bundledWorlds.test.ts` › "is stored in the current shape" on all seven worlds.
- [x] Two entities with the same picture end up linking one entry. "merges byte-identical files into one entry, whatever their MIME label (Q14)"; mutation to a whole-string key goes red.
- [x] Each entity keeps its Visibility rules per image after the migration, and play shows the same image as before for the same state. "keeps each link its own Visibility rule (Q11)"; the drone, Emberwatch and Valentines rule-swap tests read play's slots through the list.
- [x] Uploading into a gallery adds a named entry and links it. `MediaImagePanel.test.tsx` blank-card upload (entry named `new` from `new.webp`) and Replace; `relinkGallery` › "places an upload as a named entry".
- [x] Removing a gallery image unlinks it and leaves the entry. `relinkGallery` › "unlinks a removed picture and leaves its entry".
- [x] Optimize Images re-encodes a shared entry once. `imageOptim.test.ts` › "re-encodes a shared Media List entry once, at its largest use"; mutation to per-use slots goes red.
- [x] Every flow from ticket 02 still round-trips a migrated world's entity. `GameDataContext.mediaList.test.tsx` loads an embedded world through `loadWorldData`, then compares, writes back and exports; ticket 02's id-form suites pass in the affected-tests gate.
- [x] Ticket 02 left this wiring untested, and a migrated world is its first real run, so check each here: saving the world writes an owned linked copy back to the library with embedded named images; the update review dialog shows no image change for an unchanged source; card export from the World Editor carries the images (a read of the card JSON is enough where the WebP encode can't run). Save: real `saveWorld` into fake IndexedDB writes `[{ data, name: 'Wren 1' }, { data, name: 'Wounded' }]`, and dropping the list from the write-back goes red. Review: `contentMatchesSource` on the migrated copy against its embedded source reads unchanged. Card: `buildEntityCardData` with the world's list, parsed back, carries the picture.
- [x] Frames of the entity editor gallery and the in-play entity view on a migrated bundled world, dark theme, 1440 wide: `.scratch/frames/gallery-editor.png`, `.scratch/frames/gallery-play.png`. Emberwatch through Playwright: Mother Hesk's two pictures with her Health rule, and the Wanderer's portrait with the keep's backdrop in play.

For you: open two or three of your own worlds and check their portraits and location backdrops look right.

> ⚠️ Export shape: world JSON now writes the Media List, and gallery links hold ids. Remind the user.

## Landed

**Not verified:**
- The update review dialog itself was not rendered; its compare (`contentMatchesSource` with the world's list) was run on a migrated copy instead.
- Card export from the World Editor was checked through `buildEntityCardData` with the list, not the export button (the WebP encode needs a canvas jsdom lacks).

**For you:**
- For you: open two or three of your own worlds and check their portraits and location backdrops look right.
- Frames: `.scratch/shared-media-list-03/frames/gallery-editor.png` and `.scratch/shared-media-list-03/frames/gallery-play.png`.

**For later tickets:**
- Optimize Images re-encodes only entries something links; an Unused entry (Q7) keeps its bytes.
- Uploads now carry the file's name on embedded pictures too (items, library entities), as Q23 allows.
- The Authoring Tour's example image still writes an embedded picture; the next load moves it into the list.
