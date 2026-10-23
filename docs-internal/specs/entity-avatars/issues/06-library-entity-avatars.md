# 06: Library Entity Avatars

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: one library-entity field, its picker, the copy-into-world rewrite and the delete warning, on the existing library-link flow.

## What to build

Every library entity carries an Avatar pick from the player's Avatar library, None, or User's Default (spec: Entity pick; Q18). A library persona's pick wins while it is played, through ticket 02's resolver (Q7). Copying a library entity into a world embeds its library Avatar into the world store and rewrites the pick to the new store id. A library id that no longer resolves becomes none. The library-link review flow treats the pick like any other field. Deleting a library Avatar names the library entities that use it, as well as the saves, and their picks become none.

## Acceptance criteria

- [x] The library entity editor shows the Avatar dropdown with library Avatars, None and User's Default. `EntityEditorModal.avatar.test.tsx` (options, library-form save, None as no pick); frames below.
- [x] Playing a library persona with a pick shows that Avatar over the world's Custom Persona pick. `libraryPersonaVrm.test.ts` (resolvePersona → resolver, and the Enter World snapshot keeps the pick); ticket 03's player view passes the library persona entity (`cc1cad5fa`). Not driven in a live game.
- [x] Copying into a world embeds the Avatar once and points the pick at the store id; a missing library Avatar becomes none. `WorldEditor.libraryAvatars.test.tsx` (Add, hash reuse incl. a hashless entry, missing → none, owned sync), `componentUpdateRun.vrm.test.ts` (review update, open and stored world, two copies → one entry).
- [x] The link review shows a changed pick. `vrmPickMatch.test.ts`: one Avatar row with both names; same file across forms reads unchanged; write-back skips a matching copy (bench).
- [x] Deleting a library Avatar names its library entities and saves; their picks become none. `MainMenu.libraryAvatarDelete.test.tsx` (real menu, dialog text, picks cleared), `libraryVrmDelete.test.ts` (revision bump).
- [x] Frame `.scratch/frames/06-library-pick.png`, light and dark, 1280 wide. Playwright at 1280×800: `.scratch/entity-avatars-06/frames/06-library-pick-light.png`, `.scratch/entity-avatars-06/frames/06-library-pick-dark.png`.
- [x] Changelog fragment. `docs-internal/changelog.d/entity-avatars-06.md`.
- [x] Export-shape reminder in the landing: library entities and saved snapshots gain the pick. Also: world store entries gain `hash` (T06-1).

## Landed

**Not verified**
- AC 2 in a live game: the resolver path and ticket 03's wiring are tested; no game was played with a library persona.
- The live-world review store read (`useLibraryLinking` write-through ref) is checked by inspection; `applyUpdate` itself is tested with two copies.

**For you**
- Add a library entity with an Avatar to a world (Entities → Add From Library), then open World Overview → Avatars: one entry named after the library Avatar.
- Play a library persona whose Avatar is set: it shows over the world's Custom Persona Avatar.
- Delete a library Avatar used by a library entity (Avatars tab, tile menu): the dialog names the entity, and its Avatar reads None after.
- Known gaps, named not fixed: world bundles compare without the hash lookup; a library id this device lacks reads None in the dropdown and "Missing Avatar" in the review, while play shows the bundled file (T02-5).
