# 06: Sounds on the List

Status: ready-for-agent
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

- [ ] A world with an entity sound, location ambience and world music migrates on load, idempotently, and plays the same.
- [ ] Two locations with the same ambience link one entry.
- [ ] Importing a sound adds a named entry and links it; Choose lists only sounds.
- [ ] A pasted https sound URL joins the list and plays.
- [ ] A dead sound URL shows the broken state in the editor.
- [ ] An entity's sound survives Save to Library and Add from Library with its name.

> ⚠️ Export shape: sound fields now hold ids in world JSON. Remind the user.
