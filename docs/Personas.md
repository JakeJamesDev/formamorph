# 🪪 Personas

A persona is who you are in the story. It gives the AI your name, your pronouns and your description.

> A persona is an [entity](Entities) with the **Persona** checkbox selected. It uses the same editor as every other entity. Authors who want players to play as a world's own entities should read [Personas for Authors](Persona-Authoring).

---

## Make a Persona

1. Open the library's **Entities** tab.
2. Select **New Entity**, or open an entity you already have.
3. On the **Profile** tab, select the **Persona** checkbox.

No copy is made. The entity is now one of your personas, and you can still add it to a world as an entity.

| Field | What the AI gets from it |
|---|---|
| **Name** and aliases | What to call you. The story's planner also reads them as "this is the player". |
| **Pronouns** | Free text, such as "she/her". Summaries and diaries use them when they write about you. |
| **AI-Facing Description** | Who you are. |
| Portrait | Shown in the picker and in the game's side panel. |

The **All | Personas** switch above the grid shows only your personas. That view keeps your folders and tile sizes. Dragging, resizing and folder edits are off while it's on.

> 💡 Narration still says "you". Characters use your name only after they learn it in the story.

## The Default Persona

Right-click a persona and select **Set as Default Persona**. A **Default** badge marks it. **Clear Default Persona** removes it.

The default stays on this device. It never goes into an export.

## Pick at Enter World

Enter World opens on a **Persona** category when at least one persona is available.

| Choice | What it means |
|---|---|
| **None** | Play as the world describes the player |
| **From This World** | Entities the author made playable. See [Play a World's Own Entity](#play-a-worlds-own-entity). |
| **Your Personas** | The personas in your library |

The category starts on a pick in this order:

1. The persona you last used in this world
2. The world's own rule, when its author set one
3. Your default persona
4. **None**

**Quick Start** uses the same order and shows no picker.

> [!NOTE]
> One entity has one role per game. A persona you pick leaves the **Library Additions** list, and an entity you add there leaves the persona list.

Some authors limit the choice. A world can start you on **None**, or offer only its own personas with no **None**. A pick you made in that world before still wins, when the world offers it.

## Play a World's Own Entity

Pick an entity under **From This World**, and you play it:

- It leaves the cast for that game, so you never meet yourself.
- The AI reads that everyone in the world already knows you.
- Its first starting location is selected for you. You can pick another.
- Its own openings leave the draw.

## Change It in Game

A row above **Stats**, **Traits** and **Location** shows your persona's portrait and name, or **None**. Select **Change** to open **Change Persona** and pick again.

| When you change | What happens |
|---|---|
| Memories written before | They keep the old name |
| A world entity you stop playing | It comes back to the cast on the next turn |
| A save from before personas | It starts on **None**, and you can give it a persona this way |
| The world | It remembers the new pick |

A library persona is read from your library each time. Edit its description once, and every save that uses it gets the edit.

> ⚠️ A save whose persona was deleted plays with none. It warns you one time when it loads.

## Persona Placeholders

A library persona can have its own [placeholders](WorldEditor#placeholders). Its Wildcards roll one time when you pick the persona, and the save keeps the values. Switch to another persona and back, and the first one reads the same values.

## Import from SillyTavern

You can bring every SillyTavern persona over in one import.

### 1. Get the files

| File | Where SillyTavern keeps it |
|---|---|
| The backup, `personas_<date>.json` | **Persona Management** → **Backup**. Your browser downloads it. |
| Your avatar images | The `User Avatars` folder inside your SillyTavern user folder: `data/default-user/User Avatars` on a default install |

The backup holds no images, so you pick the avatar files beside it.

### 2. Import

In the **Entities** tab, select **Import Entity**. Pick the backup `.json` and the avatar images together, in one pick.

| In SillyTavern | Becomes |
|---|---|
| Each persona | A library persona |
| An avatar whose filename matches the persona's | Its portrait |
| A persona with no matching image | A persona with no portrait |
| `{{user}}` in a description | The persona's own name |
| `{{char}}` in a description | "the other character" |
| The default persona | Your default, when you have none |
| Title, position, depth and role | Not imported |

A report lists each persona with no image, each skipped entry, each persona that wasn't saved and each image that matched no persona.

> [!NOTE]
> Keep the avatar filenames as SillyTavern wrote them. The import matches by filename.

## Related

- [🎭 Entities in Play](Entities) — the cast you meet, and how a game opens
- [🪪 Personas for Authors](Persona-Authoring) — playable entities, **Persona Choice**, and the prompt chips
