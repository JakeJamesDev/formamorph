# 06: Library Entity Avatars

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: one library-entity field, its picker, the copy-into-world rewrite and the delete warning, on the existing library-link flow.

## What to build

Every library entity carries an Avatar pick from the player's Avatar library, None, or User's Default (spec: Entity pick; Q18). A library persona's pick wins while it is played, through ticket 02's resolver (Q7). Copying a library entity into a world embeds its library Avatar into the world store and rewrites the pick to the new store id. A library id that no longer resolves becomes none. The library-link review flow treats the pick like any other field. Deleting a library Avatar names the library entities that use it, as well as the saves, and their picks become none.

## Acceptance criteria

- [ ] The library entity editor shows the Avatar dropdown with library Avatars, None and User's Default.
- [ ] Playing a library persona with a pick shows that Avatar over the world's Custom Persona pick.
- [ ] Copying into a world embeds the Avatar once and points the pick at the store id; a missing library Avatar becomes none.
- [ ] The link review shows a changed pick.
- [ ] Deleting a library Avatar names its library entities and saves; their picks become none.
- [ ] Frame `.scratch/frames/06-library-pick.png`, light and dark, 1280 wide.
- [ ] Changelog fragment.
- [ ] Export-shape reminder in the landing: library entities and saved snapshots gain the pick.
