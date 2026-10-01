# 🎭 Entities in Play

Who the story counts as present with you: the cast the author wrote, the entities you add from your library, and the ones the story invents as it goes.

> Authoring a world's cast is the [World Editor](WorldEditor)'s job. This page is about the same entities at **runtime**: who the story counts as present, and what it does with an entity it made up itself.

## How to See Who Is in the Scene

1. During play, open the side panel's **Entities** tab. On desktop, select **Entities** above the panel if the avatar shows.
2. Read the list. Your persona heads it, marked **(You)**.
3. Select an entry to open its details.

## How to Add Your Own Entities to a Game

1. On the main menu, select a world.
2. Select **Enter World**.
3. Open the **Library Additions** category. See [Library Additions](Starting-a-Game#library-additions).
4. Select the entities and dictionaries from your library that this game should have.
5. To start future games in this world with the same picks, select **Remember Additions**.
6. Select **Start game**. In a world with a 3D model, the button reads **Continue to Avatar**.

## How to Remove a Cast Member

1. During play, open the side panel's **Entities** tab.
2. Find the entry and select its trash button, **Remove** followed by its name.
3. Select **Confirm** in the **Remove …?** dialog.

Only story-invented entities and Library Additions have the button. See [Removing One](#removing-one).

## How to Get Descriptions for New Entities

1. Open **Settings**.
2. Select **Advanced** next to the title.
3. Open the **Output** tab.
4. In the **Characters** section, turn on **Describe New Characters**.

---

## Three Kinds of Entity

| | **Authored** | **Library Addition** | **Story-invented** |
|---|---|---|---|
| Where it comes from | The author wrote it in the World Editor | You picked it from your library at Enter World | The story made it up mid-scene |
| Lives in | The world. Every playthrough gets it. | This playthrough | This playthrough |
| Editable | Yes, in the World Editor | Yes, in your library | No |
| Removable during play | No | Yes | Yes |
| Survives a new game | Yes | Only with **Remember Additions** | No |

All of them appear in the **Entities** tab during play. All of them count the same way when the story works out who is present and what you can do next.

## Entities the Story Invents

Ask a shopkeeper for directions, and the story might answer with a name nobody wrote. The game reads names straight out of the narration, so an invented entity joins the scene the moment the story names it. It then counts as present, and the story considers it when it offers you choices.

This costs nothing and is always on. It works in every Thinking mode, including plain narration with no planning.

> [!NOTE]
> Not every capitalized name becomes an entity. A talent agency, a café, a weekday and a song title all *look* like names. The game only adds a name that acts like a person in the prose: it speaks, gestures, or is introduced. A name that only recurs, and never does something, is left alone.

Two signals identify a person at once, with no second mention:

| Signal | Example |
|---|---|
| A **title** | *"**Doctor** Chen sets down the chart."* |
| A **body part or an expression** | *"**Lyria's** hand is warm as it closes around yours."* |

Only a person has a hand, a voice, a gaze or a face, so one of those is enough. A place or an object with a possessive, such as *Teldorill's markets* or *the inn's roof*, is not an entity and is skipped.

### Being Shown vs Being Mentioned

Someone your companion only *talks about*, such as an absent neighbor, is not added to your cast. An entity has to appear in the story's own narration, not only inside someone's quoted dialogue. One who introduces themselves (*"I'm Freya"*) counts as shown.

That keeps your **Entities** tab to the ones actually in the room with you.

## Descriptions

[Settings](Settings#characters) → **Output** → **Characters** → **Describe New Characters**. The **Characters** section shows in **Advanced** mode only.

Turn this on, and each invented entity also gets a written description. You can then open it from the **Entities** tab and read who it is, the same as an authored entity.

| | Setting off *(default)* | Setting on |
|---|---|---|
| Appears in the **Entities** tab | ✅ | ✅ |
| Counted as present in the scene | ✅ | ✅ |
| Considered when offering you choices | ✅ | ✅ |
| Has a description you can open | ❌ | ✅ |
| Costs a request | Never | One, the first time the story names each new entity |

Only the description costs a request, so only the description is a setting. It starts on the first time if **Character Diaries** was already on. After that, the two settings are separate.

## Removing One

The game reads names out of the prose, so the story sometimes capitalizes something that isn't a person, and the game adds it anyway.

Select the trash button beside the entry, then **Confirm**. Removing a story-invented entity or a Library Addition:

- takes it out of the current scene
- **remembers the decision**, so the game doesn't pick up the same name again in this playthrough
- leaves the story's text as it is

The world's authored cast has no remove button. It belongs to the world, and the World Editor is where it changes. Your persona has no remove button either.

> [!TIP]
> A removal applies to one playthrough and travels with your save. A new game starts clean.

## When It's Quiet

Some AI models rarely name anyone. They write *"she"* and *"the woman in the white coat"* for a whole scene. Then there is no name to catch. If your **Entities** tab stays short while the prose is full of people, that's the model's style, not a setting you missed.

The game picks up entities written with **names**. It can't pick up entities written with **pronouns** only.

## How a Game Opens

At **Start game**, the game draws one opening. **Quick Start** draws the same way. The [World Editor](World-Editor-Openings) page explains how authors write them.

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

An entity you play as your [persona](Personas#play-a-worlds-own-entity) keeps its Others openings out of the draw, so page one never greets you as yourself. Its Self openings, if any, replace every other opening.

Loading a save draws nothing.

### Regenerating Page One

**Re-generate Narration** on page one draws another opening. It doesn't repeat one you already saw this session until every opening has come up.

| The new draw is | Result |
|---|---|
| **Opening Narration** | It replaces page one. |
| **Opening Action** | The game goes back to the start, with the action in your input box. |
| The same single Opening Narration | Page one stays as it is. |

> [!NOTE]
> The no-repeat memory lasts for the session only. After a reload, any opening can come up again.

## Related

- [🪪 Personas](Personas): who you are in the story
- [🧠 Story Memory](Memory): how the story remembers what the cast did
- [🛠️ World Editor](WorldEditor): authoring the cast that ships with your world
