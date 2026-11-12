# 04: Morphie Reads Entity Places

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Morphie's two views of a world ask the Entity Places module.

- **The world index (#4).** For an author, an entity's places come from Presence. The index names Player's Starting Location and Can Also Go, and tells where the entity begins from where a Schedule row sends it. Today it reads the stored list, which has neither.
- **The player view (#5).** In a game, a met entity's place comes from Position. Today one path hands the authored cast to the player view, so a met Unique entity shows at every routine place the player visited. It shows at the one place it stands, and only when the player view rules already let the player know it (ADR-0014 does not change).

NPC Schedules tickets 31 and 35 already changed the world index: an entity's page lists its Starts, each with its rows, and Can Also Go, and has no derived Locations field for an entity with a kind. Keep that page. What is left for the index: take the places from Presence so a Start at Player's Starting Location also names the world's starting locations, and so a row place with no path from its Start is not presented as a place the entity can be. The player view correction (#5) is untouched by those tickets; confirm that before you start and say so in the landing.

Add both readers to the agreement test. Rebuild the help vectors only if a help topic's text changes.

Spec rulings: Q9 (#4, #5), Q7.

## Acceptance criteria

- [x] In the editor, Morphie's index lists for an entity each Presence place with whether the entity begins there, a row sends it there, or Can Also Go lists it. (`worldIndex.test.ts` "lists each place with whether the entity begins there…": a new **Can Be At** list, with the Presence tab's reason words.)
- [x] An entity that begins at Player's Starting Location is listed at the world's starting locations. The test fails with the old read. ("lists a Player's Starting Location Start at the world's starting locations"; it failed with the stored list restored.)
- [x] Can Also Go set to Anywhere is stated as such and is not listed as every location. ("states Can Also Go set to Anywhere as such…")
- [x] In a game, a met Unique entity appears at one place in the player view. The test builds a game where it visited two routine places and fails with the old read. (`playerViewWorld.test.ts` "stands at its one Position"; it failed with the old read restored.)
- [x] The player view shows no place for an entity the player has no way to know, as before. ("…a place the player has not met", "stands nowhere with no Position"; an unmet entity has no copy at all.)
- [x] The agreement test holds both readers. (`entityPlaces.agreement.test.ts` "Morphie's readers agree with Entity Places": Can Be At and Entities Here read Presence, the player view reads Position.)
- [x] The landing says what ticket 31 of NPC Schedules had already changed here. (See Landed.)
- [x] A changelog fragment records the two fixes. (Q25 applies: the index fix is kinds-only and gets no fragment. The player view fix also shows in v3.6.2 for a character a script moved, so it has a fragment.)

For you: ask Morphie in a bundled world where a named character is, once in the editor and once in a game, and judge whether the answer reads right.

Spec rulings added after this ticket was written: Q19, Q22. Ticket 06 owns `presenceLines`: it gives it a world argument and makes it read Presence, so Morphie's location pages change there. For that part this ticket adds only its reader to the agreement test.

## Landed

**Already changed by NPC Schedules.** Ticket 31 (f6a431ada) gave the entity page its Starts with rows and Can Also Go. Ticket 35 dropped the derived Locations field for an entity with a kind. This ticket keeps that page and adds **Can Be At**, read from Presence. The player view path (#5) was untouched by those tickets: `playerEntity` still kept the stored list, filtered to met places, as e874fb237 wrote it.

**Fixes for the entity kinds entry (Q25, no fragment):**
- Morphie's world index lists each place an entity with a kind can be, with its reasons. A Player's Starting Location Start names the starting locations, and a row place its Start cannot reach is left out.
- In a game, Morphie's code test places a met Unique or Generic entity only where it stands, at a place the player has met. With no Position it is nowhere (Q10).

**Fragment:** the player view also reads Position for an entity with no kind. v3.6.2 writes that Position when a script moves a character, so that change got a fragment.

**Also changed:** the Locations line of an entity with no kind now drops ids the world does not have (Q19) and shows chips as the author sees them.

**Not verified:** nothing unticked.

**For you:**
- Ask Morphie in a bundled world where a named character is, once in the editor and once in a game, and judge whether the answer reads right.
- In a game, Morphie's code test now sees a met character's place at any place you have visited, even when you are elsewhere, as Tools already did through `positions`. Judge whether that is the knowledge you want it to have.
