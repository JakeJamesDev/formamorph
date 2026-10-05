# 🪪 Personas
<!-- keywords: protagonist, my identity, who am i, hero -->

A persona is who you are in the story. It gives the AI your name, your pronouns and your description.

> A persona is an [entity](Entities) with **Persona** set to **Playable**. It uses the same editor as every other entity. Authors who want players to play as a world's own entities should read [Personas for Authors](Persona-Authoring).

## How to Make a Persona
<!-- keywords: create, player character, play as, my character, user character, self, profile, original character, oc, describe myself, character sheet, my backstory, new identity, roleplay identity, build a hero -->
<!-- route: mainMenu.entities -->

1. Open the library's **Entities** tab.
2. Select **New Entity**, or open an entity you already have.
3. On the **Entity** tab, open **Profile**.
4. Set the **Persona** control to **Playable**. In the library it has two choices, **Cast** and **Playable**.
5. Select **Save**.

No copy is made. The entity is now one of your personas, and you can still add it to a world as an entity.

## How to Set a Default Persona
<!-- keywords: always, main character, preferred, usual, favorite, automatic, preselected, primary, go to identity, remember my choice, unset, standard pick, same one each game -->
<!-- route: mainMenu.entities -->

1. Open the library's **Entities** tab.
2. Right-click a persona tile.
3. Select **Set as Default Persona**.

A **Default** badge marks it. To remove it, right-click the tile and select **Clear Default Persona**.

## How to Pick a Persona
<!-- keywords: choose, select, play as, character select, who to play, which character, roster, at game start, type my name, name myself, nameless, playing as nobody, before the story -->
<!-- route: enterWorld -->

1. On the main menu, select a world.
2. Select **Enter World**.
3. Open the **Persona** category. It shows when at least one persona is available.
4. Select **None**, an entity under **From This World**, or one under **Your Personas**.
5. If the world shows a **Custom Persona** in **None**'s place, type your **Name** and, if you like, a **Description**.
6. Select **Start game**. In a world with a 3D model, the button reads **Continue to Avatar**.

## How to Change Persona During Play
<!-- keywords: switch, swap, mid-game, different character, edit name, rename, already started, ongoing story, become someone else, wrong name fix, replace protagonist, halfway through, body swap -->
<!-- route: persona -->

1. In the side panel, find the persona row above the **Stats**, **Traits** and **Location** tabs.
2. Select **Change**. The **Change Persona** dialog opens.
3. Pick another persona, or edit the Custom Persona's **Name** or **Description**.
4. Select **Change**. It turns on when your pick, name or description differs from the current one.

## How to Import SillyTavern Personas
<!-- keywords: tavern, st, user avatars, backup, migrate, bring over, convert from other app, transfer profiles, old frontend, portraits folder, carry across, switching apps, existing profiles -->
<!-- route: mainMenu.entities#import-entity -->

1. In SillyTavern, open **Persona Management** and select **Backup**. Your browser downloads `personas_<date>.json`.
2. Find your avatar images in the `User Avatars` folder inside your SillyTavern user folder. On a default install it is `data/default-user/User Avatars`.
3. In Formamorph, open the library's **Entities** tab and select **Import Entity**.
4. Pick the backup `.json` and the avatar images together, in one pick.
5. Read the report. See [Import from SillyTavern](#import-from-sillytavern).

---

## What the AI Reads
<!-- keywords: gender, he she they, nickname, bio text, what narrator knows, my appearance, still says you, show only mine -->

| Field | Where | What the AI gets from it |
|---|---|---|
| **Name** and **Aliases** | **Profile** | What to call you. The story's planner also reads them as "this is the player". **Aliases** shows in Advanced mode. |
| **Pronouns** | **Profile** | Free text, such as "she/her". Summaries and diaries use them when they write about you. |
| **AI-Facing Description** | **Descriptions** | Who you are. |
| **Image** | **Profile** | Your portrait. It shows in the picker and in the game's side panel. |

The **All | Personas** switch above the grid shows only your personas. That view keeps your Groups and tile sizes. Dragging, resizing and Group edits are off while it's on. See [The Library Tabs](Library#the-library-tabs).

> 💡 Narration still says "you". Entities use your name only after they learn it in the story.

## The Default Persona
<!-- keywords: fallback identity, used automatically, not synced, this device only, auto picked -->

The default persona is the one Enter World and **Quick Start** pick when nothing else decides. The default stays on this device. It never goes into an export.

## Pick at Enter World
<!-- keywords: preselection priority, why this one chosen, forced character, my own missing, restricted list, last used remembered, one role per game -->

Enter World opens on a **Persona** category when at least one persona is available.

| Choice | What it means |
|---|---|
| **None** | Play as the world describes the player. A world with a [Custom Persona](#create-your-own) shows that entity here instead. |
| **From This World** | Entities the author made playable. See [Play a World's Own Entity](#play-a-worlds-own-entity). |
| **Your Personas** | The personas in your library |

The category starts on a pick in this order:

1. The persona you last used in this world
2. The world's **Starts On** rule, when its author set one
3. Your default persona. When the world allows **World Only**, its first own persona instead.
4. **None**

A pick the world doesn't offer is skipped. **Quick Start** uses the same order and shows no picker.

> [!NOTE]
> One entity has one role per game. A persona you pick leaves the **Library Additions** list, and an entity you add there leaves the persona list.

Some authors limit the choice. A world can start you on **None**, or offer only its own personas with no **None**. A pick you made in that world before still wins, when the world offers it.

## Play a World's Own Entity
<!-- keywords: be an npc, premade hero, canon character, pregenerated, take over cast member, meeting myself, story already knows me -->

Pick an entity under **From This World**, and you play it:

- It leaves the cast for that game, so you never meet yourself.
- The AI reads that everyone in the world already knows you.
- Its first starting location is selected for you. You can pick another.
- Its Others openings leave the draw, so page one never greets you as yourself.
- If it has Self openings, the game draws only from those. See [Self Openings](World-Editor-Openings#self-openings).

A persona from your library can bring its own Self openings. They draw in any world you play it in. If it has none, the world's Custom Persona Self openings apply. See [Self Openings](World-Editor-Openings#self-openings).

## Create Your Own
<!-- keywords: self insert, blank slate, fill in my details, enter my name, race and class picks, replaces none option, author portrait shown -->

Some worlds have a **Custom Persona**. It takes **None**'s place in the list, with the author's portrait and name. Pick it, and **Name** and **Description** fields open under it.

- **Your name replaces the entity's name.** The story calls you by it.
- **Your description follows the author's.** The AI reads both.
- **The world can give you traits**, such as a race and a class. They stay when you switch between it and a persona from your library.
- **A world persona you pick shows in its slot.** It leaves its own group while you play it.

**Change Persona** during play has the same entry.

## Change It in Game
<!-- keywords: memories use wrong name, legacy save identity, deleted identity warning, edits reach old saves, returns next turn, side panel row -->
<!-- route: persona -->

A row above **Stats**, **Traits** and **Location** shows your persona's portrait and name, or **None**. Select **Change** to open **Change Persona** and pick again.

| When you change | What happens |
|---|---|
| Memories written before | They keep the old name |
| A world entity you stop playing | It comes back to the cast on the next turn. An entity the author made only for the player leaves the world. |
| A save from before personas | It starts on **None**, and you can give it a persona this way |
| The world | It remembers the new pick |

A library persona is read from your library each time. Edit its description once, and every save that uses it gets the edit.

> ⚠️ A save whose persona was deleted plays with none. It warns you one time when it loads.

## Persona Placeholders
<!-- keywords: random values on me, randomized details, variables, reroll on switch, rolls kept in save -->

A library persona can have its own [placeholders](World-Editor-Placeholders). Its Wildcards roll one time when you pick the persona, and the save keeps the values. Switch to another persona and back, and the first one reads the same values.

## Import from SillyTavern
<!-- keywords: macros converted, what carries over, portraits not attached, lost fields, mapping, filename mismatch, import summary, skipped entries -->

One import brings every SillyTavern persona over. The backup holds no images, so you pick the avatar files beside it.

| File | Where SillyTavern keeps it |
|---|---|
| The backup, `personas_<date>.json` | **Persona Management** → **Backup**. Your browser downloads it. |
| Your avatar images | The `User Avatars` folder inside your SillyTavern user folder |

| In SillyTavern | Becomes |
|---|---|
| Each persona | A library persona |
| An avatar whose filename matches the persona's | Its portrait |
| A persona with no matching image | A persona with no portrait |
| `{{user}}` in a description | The persona's own name, as plain text |
| `{{char}}` in a description | The plain text "the other character" |
| The default persona | Your default, when you have none |
| Title, position, depth and role | Not imported |

A report lists each persona with no image, each skipped entry, each persona that wasn't saved and each image that matched no persona.

> [!NOTE]
> Keep the avatar filenames as SillyTavern wrote them. The import matches by filename.

## Related

- [🎭 Entities in Play](Entities): the cast you meet, and how a game opens
- [🪪 Personas for Authors](Persona-Authoring): playable entities, **Allowed Personas** and **Starts On**, and the prompt chips
