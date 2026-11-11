# 04: Morphie Reads Entity Places

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Morphie's two views of a world ask the Entity Places module.

- **The world index (#4).** For an author, an entity's places come from Presence. The index names Player's Starting Location and Can Also Go, and tells where the entity begins from where a Schedule row sends it. Today it reads the stored list, which has neither.
- **The player view (#5).** In a game, a met entity's place comes from Position. Today one path hands the authored cast to the player view, so a met Unique entity shows at every routine place the player visited. It shows at the one place it stands, and only when the player view rules already let the player know it (ADR-0014 does not change).

First check what NPC Schedules ticket 31 landed for Morphie and routines. Build on it; do not redo it. If it already moved one of these reads, say so in the landing and cover only the rest.

Add both readers to the agreement test. Rebuild the help vectors only if a help topic's text changes.

Spec rulings: Q9 (#4, #5), Q7.

## Acceptance criteria

- [ ] In the editor, Morphie's index lists for an entity each Presence place with whether the entity begins there, a row sends it there, or Can Also Go lists it.
- [ ] An entity that begins at Player's Starting Location is listed at the world's starting locations. The test fails with the old read.
- [ ] Can Also Go set to Anywhere is stated as such and is not listed as every location.
- [ ] In a game, a met Unique entity appears at one place in the player view. The test builds a game where it visited two routine places and fails with the old read.
- [ ] The player view shows no place for an entity the player has no way to know, as before.
- [ ] The agreement test holds both readers.
- [ ] The landing says what ticket 31 of NPC Schedules had already changed here.
- [ ] A changelog fragment records the two fixes.

For you: ask Morphie in a bundled world where a named character is, once in the editor and once in a game, and judge whether the answer reads right.
