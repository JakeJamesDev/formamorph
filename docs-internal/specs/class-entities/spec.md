# Class Entities

Status: proposal (draft by littleme02, for review)

## Problem Statement

Many worlds list entities that are meant as generic monsters or creatures for the story to draw from: Kitsune, Guards, Slimes, Drones. Playing, I want several unique characters from one such entity. A world with a Kitsune entry should give me Suya, and later Mirei, each her own person. Two things stop that:

- **The AI reads the entry as one person.** A roster entry for "Kitsune" looks like any cast member's, so the narrator treats Kitsune as a single named character.
- **A character the story invents is either tied to the generic entry or cut off from it.** When the narrator named a kitsune Suya, nothing connected her to the Kitsune entry. Her pictures were empty and her type unset. Her sheet ended up as a value under "Kitsune". And there was no step to write her out as her own character.

What I need is to **decouple** each invented character from the world's generic description, while still letting them start from it.

## Solution

An entity can take the **Class** role, chosen in the same place as the persona types (World Editor, Persona picker): a kind of creature, not one individual. It still joins scenes like any entity.

- **To the AI.** A Class entity's roster entry carries a class line: it is a kind of creature, any number can appear, and one the story singles out gets a name of its own. A cast entity has one instance and gets no extra line. This changes play a lot: a world of kitsune finally has more than one kitsune.
- **Inherited, not linked.** An invented character records its class and inherits from it once. If they have no pictures or type of their own, they take a copy of the class's. Later edits to the class in the World Editor don't reach a finished character.
- **The game guesses, the player decides.** When the story invents an entity in a world with classes, a quiet background request guesses which class it is an individual of. It picks from the classes living where the entity appeared, else from all of them, or answers none. The player can set or clear the class at any time.
- **The class stays recorded after the copy.** It tells the player and Write Entity what kind they are, and Write Entity reads it as a guide each time it runs.
- **A tick for stock pictures.** A **From <Class>** tick on the character's pictures marks them as the class's stock pictures rather than their own. While it is ticked, reassigning them to another class takes a fresh copy of the new class's pictures. Edits to the class in the World Editor still don't reach them. Choosing a picture of their own unticks it.
- **Write Entity.** A separate step outside the turns, started by the player, writes the character's whole entry: note, pronouns, aliases and sheet. It reads the class as a guide to the kind, the passages they appeared in, and the narrator's thinking on the turn that made them, so it knows why they were made. It never copies blindly: a class's "1 to 9 tails" becomes their one value. The draft opens in a compare window, and nothing changes until the player keeps it. It can be run again later to add to the entry as the story shows more.
- **Prompts in the prompt menu.** **Class Guess** and **Write Entity** are presets under Settings → Prompts → Story, each with its own request type, so each can take its own endpoint.

## User Stories

1. As a world author, I want to mark an entity as a Class, so that the AI knows "Kitsune" is a kind and not one person.
2. As a player, I want the narrator to introduce several individuals of a class, so that a world of kitsune has more than one kitsune.
3. As a player, I want an invented character to inherit from their class once, so that they start from the class but become their own person.
4. As a player, I want class edits in the World Editor not to change a finished character, so that Suya stays Suya.
5. As a player, I want the game to guess their class, so that I don't set every one by hand.
6. As a player, I want to set or clear a class, so that a wrong guess is easy to fix.
7. As a player, I want their pictures marked as the class's stock until I give them their own, so that a reassignment brings the right stock pictures.
8. As a player, I want to write a character's whole entry in one step outside the turns, so that an invented character becomes a full one.
9. As a player, I want Write Entity to pick one value from a class range, so that Suya has five tails, not "1 to 9".
10. As a player, I want Write Entity to know why the narrator made them, so that the entry matches what the story intended.
11. As a player, I want to compare the draft with the current entry before keeping it, so that a bad draft doesn't overwrite good text.
12. As a player, I want the Class Guess and Write Entity prompts in the prompt menu, so that I can see and change what they ask.

## Implementation Decisions

Decisions from playing with the working version:

- **D1** Class is a role, picked where the persona types are picked, not a separate entity type.
- **D2** Inherited, not linked: a one-time copy when the class is set. A class edit never reaches a finished character.
- **D3** The game guesses the class in the background; the player can always change it.
- **D4** Pictures have a **From <Class>** tick: ticked, they are the class's stock and are retaken when they are reassigned to another class; an own picture unticks it.
- **D5** Write Entity is player-started, never automatic, and always shows a compare window before anything is kept.

Open for your rulings:

- **Q1** Should the class guess run for every invented entity, or only for ones the narrator flags as a kind of something?
- **Q2** With the owner route: do a class's stats (and text stats, see the Text Stats spec) seed its individuals' starting values the way pictures do, with a tick each?
- **Q3** Does a Class entity in a scene mean "one or more of this kind is here", and should the roster say how many?
- **Q4** What should the tick mean? As built, it retakes the class's pictures only when they are reassigned. Two cleaner choices: (a) written text (note, sheet, Write Entity output) is always the character's own, while ticked stock (pictures, type) reads the class live, so class edits reach them until they have their own; or (b) a pure copy with no ticks, a **Re-copy from class** button, and the class kept only as a label and Write Entity's guide.
- **Q5** Which other fields get a tick, if any: type, pronouns, the sheet's rows?

## Testing Decisions

- Unit: the class line appears for a Class entity and not for a cast entity; the class guess reads its reply (a class name, none, an unknown name, messy text); a link copies pictures and type only when the entity has none; a class edit after the link doesn't reach the character; From <Class> retakes pictures on reassignment and unticks on an own picture.
- e2e (mocked endpoint): a world with a Class entity; the narrator invents a name; the class guess request is sent with the classes living there; the invented character shows the class and its pictures; Write Entity's draft opens in the compare window.

## Out of Scope

- Generating pictures for an individual from its class's pictures.
- Classes of locations or items.

## Further Notes

A working version runs in my fork (`ultra` branch): the class line, the class guess, inherited pictures with the From <Class> tick, and Write Entity using the class as a guide, with a compare window. It edits invented characters in the All Entities window (see the All Entities spec).
