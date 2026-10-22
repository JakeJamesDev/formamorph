# All Entities And Game Copies

Status: proposal (draft by littleme02, for review)

## Problem Statement

The Entities tab shows who is in the current scene. Everything else about the game's characters is out of reach during play:

- **Invented entities can't be listed or fixed.** There is no way to list and edit every entity the story generated, only the ones in the current scene. A wrong note, place or pronoun stays wrong.
- **Names with no entity.** With Describe New Characters off, a name the story invents shows in the Entities tab but opens nothing and is in no list. A name the narrator wrote but never flagged has no way in at all.
- **The world's own characters can't change per game.** Editing a world character changes every game of that world. A player who wants this game's version of a character to have grown, been hurt or changed sides has nowhere to put it. Their chips are read from the world as well, so an attire chip the game started with stays as the world wrote it, even after the story changed what they wear.
- **The persona is shared.** Editing the persona in one game changes it in every other game that plays it. The workaround, keeping copies of the persona, is just bad.

## Solution

An **All Entities** window, opened from the top of the Entities tab, lists every entity in the game with where it is: the player first, then the invented entities, then the game copies of world characters. Each one's entry can be edited, with **Save** and **Cancel**. Writes stay in the save, and the world is never touched.

- **Edit an entity.** Note, pronouns, Also Known As, place (with a change-location control per entity), pictures (the World Editor's gallery: add, remove, reorder, Use as Main Picture) and, where the world has them, sheet rows and class.
- **Rewrite Note.** The note is rewritten from what the story has shown of the entity since it first appeared.
- **Write Entity.** The model drafts the whole entry. See the Class Entities spec. The draft opens in a compare window.
- **Remove.** Removes an invented entity, its sheet included.
- **Make permanent.** A name in the Entities tab with no entity behind it gets a pin. It describes the name from the latest turn it appears in (the existing discover request, as a background job) and adds it where that turn took place.
- **Add by name.** A name the narrator wrote but never flagged can be typed in. It is described from the turns that name it: the last few (**Look back**), or **every turn that names them**. With **Your notes** ticked, the paragraphs of the player's notes that name it are read too. The earliest naming turn is where it first appeared.
- **Game copies.** A world character in the Entities tab gets a pin, **Make a game copy**. Its text, chips filled in with this game's values, goes into the save under the same id. It becomes an entity like the ones the story invented, so the game plays the copy in place of the world's version, and every tool above works on it. All Entities marks it **From the world**. **Reset to World** drops the copy.
- **The persona's copy.** Each game plays its own copy of the persona's name, aliases, pronouns, descriptions and pictures, pulled in as an entity like any other character. All Entities edits the copy, and **Reset to Persona** retakes it.

## User Stories

1. As a player, I want to see every entity in my game, not only the scene's, so that I can find one the story left behind.
2. As a player, I want to correct an invented entity's note, place and pronouns, so that the AI stops repeating a mistake.
3. As a player, I want to move an entity to another place, so that the game knows where they went when the story didn't say.
4. As a player, I want the AI to rewrite a note from what the story has shown since, so that it keeps up with the character.
5. As a player, I want to make an invented name permanent from the Entities tab, so that a name with no entry gets one.
6. As a player, I want to add a character by name from the prose, choosing how far back to read and whether to read my notes, so that someone the narrator never flagged can become an entity.
7. As a player, I want this game's copy of a world character, so that I can change them for this story without changing the world.
8. As a player, I want a game copy's chips filled in with this game's values, so that the story can change what they wear or carry.
9. As a player, I want Reset to World on a copy, so that I can go back to the author's version.
10. As a player, I want each game to keep its own copy of my persona, so that editing it in one game leaves the others alone.
11. As a player, I want edits kept in the save only, so that a world I downloaded stays as its author made it.

## Implementation Decisions

Decisions from playing with the working version:

- **D1** The window is named **All Entities**, not Characters: it holds anything the world calls an entity.
- **D2** A game copy reuses the invented entities' machinery under the world entity's id, so every tool works on it with nothing new built for each.
- **D3** A game copy bakes its chips into text with this game's values when it is made. The game's copy is what the story changes, and the world's chips describe the start.
- **D4** The persona is pulled into each game as its own copy, editable in play.
- **D5** Adding by name and making permanent should get their own window, with progress and status while the model works, rather than a toast.

Open for your rulings:

- **Q1** Does All Entities live in its own window (as in the working version) or as a mode of the Entities tab?
- **Q2** Is the same-id seam right for game copies, or should a copy be an overlay the lookups apply?
- **Q3** With the owner route: does a game copy carry its own stats, or keep reading the world entity's?
- **Q4** Should a game copy be offered at game start for every world character, or only on demand, as now?

## Testing Decisions

- Unit: gathering the material for a name (look back, every turn, notes, whole-word match); a game copy standing in for the world entity; Reset to World; the persona copy; saves without these fields load as before.
- e2e (mocked endpoint): Make permanent describes and adds a name; Add by name with Look back and notes; Make a game copy, edit it, play a turn and see the copy in the request; Reset to World.

## Out of Scope

- Editing world entities themselves from play.
- Merging two entities that turn out to be one person.
- Pictures of an entity drawn from its game state (where they are now). The working version has this, but it belongs to an image spec.

## Further Notes

A working version runs in my fork (`ultra` branch). It uses sheets (see the Text Stats spec) and classes (see the Class Entities spec) where the world has them, and works without either.
