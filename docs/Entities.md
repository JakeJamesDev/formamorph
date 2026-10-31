# 🎭 Entities in Game
<!-- keywords: companions, party members, side characters, who counts as there, supporting roles -->
<!-- route: gameViewer.entities -->

During the game, the story counts some entities as present with you. They come from three places: the world's author, your library, and the story itself.

> To write a world's entities, use the [World Editor](WorldEditor). This page covers the same entities **during the game**: which ones the story counts as present, and what it does with an entity it invents.

## How to See Who Is in the Scene
<!-- keywords: characters, npcs, people, present, list, cast, nearby, who is here, around me, in the room, party roster, look someone up, view their bio, current company -->
<!-- route: gameViewer.entities -->

1. During the game, open the side panel's **Entities** tab. On mobile, the panel opens on **View**; select **Entities** next to it.
2. Read the list. Your persona is first, marked **You**. The entities at your location come next, with those in the scene first.
3. Look for the footprints icon on an entry. Its tooltip reads **Following you**. That entity follows you. See [Movement](World-Editor-Locations#entities).
4. Select an entry to open its details. See [The Entity Dialog](How-to-Play#the-entity-dialog).

A stranger shows under the name you know. Its entry opens [The Stranger Dialog](How-to-Play#the-stranger-dialog).

## How to Add Your Own Entities to a Game
<!-- keywords: characters, npcs, bring, include, library, custom characters, extra, import, my oc, bring a companion, guest star, crossover, insert into any world, keep picks next time, extra lorebooks -->
<!-- route: enterWorld -->

1. On the main menu, select a world.
2. Select **Enter World**.
3. Open the **Library Additions** category. See [Library Additions](Starting-a-Game#library-additions).
4. Select the entities and dictionaries from your library that this game should have.
5. To start future games in this world with the same picks, select **Remember Additions**.
6. Select **Start Game**. When the persona you play has an Avatar, the button reads **Continue to Avatar**.

## How to Remove an Entity from Your Game
<!-- keywords: delete, character, npc, get rid of, kick out, drop, wrong name listed, not a real person, clean up list, false positive, dismiss, bogus entry, trash button missing, cast member -->
<!-- route: gameViewer.entities -->

1. During the game, open the side panel's **Entities** tab.
2. Find the entry and select **Remove**. This is the trash icon button beside the entry. Its tooltip reads **Remove** followed by the entity's name.
3. In the **Remove …?** dialog, select **Confirm**.

Only story-invented entities and Library Additions have the button. See [Removing an Entity](#removing-an-entity).

## How to Get Descriptions for New Entities
<!-- keywords: characters, npcs, invented, auto describe, profile, details, generate, blank bio, empty entry, who is this person, made up people, auto backstory, write up strangers, nothing to read -->
<!-- route: settings.output#settings-mode -->

1. Open **Settings**.
2. Select **Advanced** next to the title.
3. Open the **Output** tab.
4. In the **Characters** section, turn on **Describe New Characters**.

---

## Three Kinds of Entity
<!-- keywords: types compared, difference between, categories, carry into next game, which can i edit, which can be deleted, origin -->

| | **Authored** | **Library Addition** | **Story-invented** |
|---|---|---|---|
| Where it comes from | The author wrote it in the World Editor | You picked it from your library at Enter World | The story made it up during a scene |
| Where it's stored | The world. Every playthrough gets it. | This playthrough | This playthrough |
| Editable | Yes, in the World Editor | Yes, in your library | Its description only, in its dialog |
| Removable during the game | No | Yes | Yes |
| Kept for a new game | Yes | Only with **Remember Additions** | No |

All three kinds show in the **Entities** tab during the game. The story treats them the same way when it decides which entities are present and what you can do next.

## Entities the Story Invents
<!-- keywords: ai made someone up, improvised npc, auto added names, name detection, why was he skipped, only talked about, random stranger appears, place listed as person, on the fly -->

Ask a shopkeeper for directions, and the story might answer with a name no author wrote. The game reads names from the narration. An invented entity joins the scene as soon as the story names it. It then counts as present, and the story considers it when it offers you choices.

This costs nothing and is always on. It works in every Thinking mode, including plain narration with no planning.

> [!NOTE]
> Not every capitalized name becomes an entity. A talent agency, a café, a weekday and a song title all *look* like names. The game adds a name only when the name acts like a person in the narration: it speaks, gestures, or is introduced. A name that only comes up again, and never does anything, stays off the list.

Three signals identify a person on the first mention:

| Signal | Example |
|---|---|
| A **title** | *"**Doctor** Chen sets down the chart."* |
| A **body part or an expression** | *"**Lyria's** hand is warm as it closes around yours."* |
| A **self-introduction** | *"I'm **Freya**."* |

Only a person has a hand, a voice, a gaze or a face, so one of those is enough. The game skips a place or an object with a possessive, such as *Teldorill's markets* or *the inn's roof*.

### Being Shown vs Being Mentioned

The game doesn't add a name that your companion only *talks about*, such as an absent neighbor. An entity has to appear in the narration itself, not only inside quoted dialogue. An entity that introduces itself (*"I'm Freya"*) counts as shown.

Your **Entities** tab then lists only the entities in the room with you.

## Descriptions
<!-- keywords: extra api calls, token cost, bio generation, unable to open entry, slower turns, tied to diaries, advanced only setting -->

[Settings](Settings#characters) → **Output** → **Characters** → **Describe New Characters**. The **Characters** section shows in **Advanced** mode only.

Turn this on to give each invented entity a written description. You can then open the entity from the **Entities** tab and read about it, the same as an authored entity.

| | Setting off *(default)* | Setting on |
|---|---|---|
| Appears in the **Entities** tab | ✅ | ✅ |
| Counted as present in the scene | ✅ | ✅ |
| Considered when offering you choices | ✅ | ✅ |
| Has a description you can open | ❌ | ✅ |
| Costs a request | Never | One, the first time the story names each new entity |

Only the description costs a request, so only the description is a setting. The first time, the setting starts on if **Character Diaries** is already on. After that, the two settings are separate.

With the setting on or off, an invented entity's dialog has **Edit** and **Regenerate** for its description. See [The Entity Dialog](How-to-Play#the-entity-dialog).

## Removing an Entity
<!-- keywords: keeps coming back, stays gone, ignore list, why no button, does it rewrite story, only this save, author characters stuck -->

The game reads names from the narration. Sometimes the story capitalizes something that isn't a person, and the game adds it anyway.

Select **Remove** beside the entry, then **Confirm**. Removing a story-invented entity or a Library Addition:

- takes it out of the current scene
- **remembers the decision**, so the game doesn't add the same name again in this playthrough
- leaves the story's text as it is

The world's authored entities have no **Remove** button. They belong to the world, and you change them in the World Editor. Your persona has no **Remove** button either.

> [!TIP]
> A removal applies to one playthrough and travels with your save. A new game starts clean.

## When the List Stays Short
<!-- keywords: list is empty, nobody detected, missing people, unnamed strangers, not picking anyone up, depends on model -->

Some AI models rarely use names. They write *"she"* and *"the woman in the white coat"* for a whole scene, so the game has no name to read.

The game picks up entities written with **names**. It can't pick up entities written with **pronouns** only. If your **Entities** tab stays short while the narration is full of people, the cause is the model's writing style. You didn't miss a setting.

## How a Game Opens
<!-- keywords: first message, intro scene, alternate greetings, random beginning, reroll the start, same start every time, why this beginning, starts with filled input -->

At **Start Game**, the game draws one opening. **Quick Start** draws the same way. The [World Editor](World-Editor-Openings) page explains how authors write openings.

| At Enter World you pick | The draw uses |
|---|---|
| A persona with [Self Openings](World-Editor-Openings#self-openings) | Only those Self openings, by weight |
| **None**, and the world has a **Custom Persona** with Self openings | Only the Custom Persona's Self openings |
| A library persona with no Self openings, and the same Custom Persona | Only the Custom Persona's Self openings |
| One or more entities with openings in **Library Additions** | Only the picked entities' Others openings, by weight. They replace the world's openings. |
| Nothing above | The world's openings, the openings of your starting location, and those of entities at your starting location |

You start on the default opening in three cases:

- No source has an opening for your start.
- The author switched the world's openings list off. This turns off every row above, Self openings and Library Additions included.
- The world, its entities and its locations have no openings, and your persona brings no Self openings. Openings that only Library Additions bring don't switch the list on.

When you play an entity as your [persona](Personas#play-a-worlds-own-entity), its Others openings stay out of the draw. Page one never greets you as yourself. Its Self openings, if any, replace every other opening.

Loading a save draws nothing.

### Regenerating Page One

**Re-generate Narration** on page one draws another opening. It doesn't repeat an opening you already saw this session until every opening has come up.

| The new draw is | Result |
|---|---|
| **Opening Narration** | It replaces page one. |
| **Opening Action** | The game goes back to the start, with the action in your input box. |
| The same single Opening Narration | Page one stays as it is. |

> [!NOTE]
> The game remembers the openings you saw for this session only. After a reload, any opening can come up again.

## Related

- [🪪 Personas](Personas): who you are in the story
- [🧠 Story Memory](Memory): how the story remembers what its entities did
- [🛠️ World Editor](WorldEditor): writing the entities that ship with your world
