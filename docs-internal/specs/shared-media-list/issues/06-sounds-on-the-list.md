# 06: Sounds on the List

Status: done
Blocked by: 02, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Entity sounds, location ambient sounds and world music move onto the Media List (Q1), with the same pick-or-import slot as images and a basic sound URL (Q17).

- The `migrateWorld` step extends to these fields, merging identical files.
- Playback resolves through the resolver: the entity card player, location ambience and world music.
- The sound slot uses ticket 04's picker pattern with an audio row in place of the picture: Import, Choose (names, filtered to sounds), a sound URL box, a name field, Unlink, Delete from World.
- A linked sound shows a linked marker. One that fails to load shows a broken state, from the audio element's error event.
- No offline cache and no export embedding for linked sounds.
- The library boundary from ticket 02 carries entity sounds with their names.
- Ships its docs: the wiki's sound pages.

## Acceptance criteria

- [x] A world with an entity sound, location ambience and world music migrates on load, idempotently, and plays the same. `mediaSounds.test.ts` (links, "is idempotent and deterministic"); playback through the list in `EntityCard.test.tsx` and `GameViewer.mediaSounds.test.tsx`; live in the preview on a drone copy.
- [x] Two locations with the same ambience link one entry. "links two locations with the same ambience to one entry"; seen live (`rain`).
- [x] Importing a sound adds a named entry and links it; Choose lists only sounds. `MediaSoundSlot.test.tsx` (`harbor theme`; Choose shows `growl`, not the portrait); mutation to an unfiltered Choose goes red.
- [x] A pasted https sound URL joins the list and plays. "adds a pasted https sound URL as a linked entry that plays from the link" (audio `src` is the URL, **Linked** shows).
- [x] A dead sound URL shows the broken state in the editor. The audio element's error event in the test; live with a dead localhost link (`.scratch/frames/sound-slot-broken-link-dark-1440.jpg`).
- [x] An entity's sound survives Save to Library and Add from Library with its name. `libraryMedia.test.ts` › "keeps the sound and its name through Save to Library and Add from Library"; the compare and Check for Updates cases beside it.

> ⚠️ Export shape: sound fields now hold ids in world JSON. Remind the user.

## Landed

**Not verified:**
- The import's unmount guard (a slot closed mid-read writes nothing) has no test; it follows the `useMountedRef` pattern.
- `mediaParents` keeps a link written to a sound slot as is, and writes a file embedded in a world without a list. No screen reaches either branch today.
- A dead link to another host was not tried; the broken state was checked with a localhost link that serves HTML.

**For you:**
- The Media tab's sound panel shows the slot (name, ✖️ **Remove From Slot**, 🗑️ **Delete From World**) above the panel's own **Replace** and **Remove**, as ticket 04's image panel does. Judge whether one set should go.
- The **Linked** badge on a sound: keep the word, or say "Linked Sound".
- `editorAdvancedData` counts an ambience link to a deleted entry as Advanced data.
- Frames: `.scratch/shared-media-list-06/frames/sound-slot-empty-dark-1440.jpg`, `sound-slot-choose-dark-1440.jpg`, `sound-slot-filled-dark-1440.jpg`, `sound-slot-broken-link-dark-1440.jpg`, `entity-sound-dark-1440.jpg`, `entity-sound-light-1440.jpg`.

**For later tickets:**
- `UrlCommitField` in `UtilityComponents.tsx` is the shared link box for image and sound slots.
- `MediaChooseButton` and `DeleteMediaConfirm` take `kind`; `resolveSound` and `storedMusic` live in `lib/mediaSounds`.
