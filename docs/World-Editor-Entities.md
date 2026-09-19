# 🎭 World Editor: Entities

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Entities are the people, creatures and things in your world: a ferryman, an eel-smoker, a barred door. An entity belongs to one or more **Locations**. The AI reads the entities that can show up where the player is.

## Why it exists

Without entities, the narrator invents a stranger, names them, and forgets both by the next turn. An entity is a fixed person or thing the story can come back to. The AI reads about it again each time the player is at one of its locations.

The default prompt introduces entities as "Characters and things that **may** appear in this location". That wording is a hint to the AI. The game doesn't enforce it, and the narrator can use anyone on the list. You can change the wording in the prompt editor.

## The panel

Select an entity to open its panel.

| Tab | Holds | Mode |
|---|---|---|
| **Profile** | Name, aliases, pronouns, type, locations, the image and the 3D model | Simple and Advanced |
| **Descriptions** | The three description fields | Simple and Advanced |
| **Openings** | The entity's own openings | Advanced only |
| **Placeholders** | The entity's own [placeholders](World-Editor-Placeholders#placeholders-that-belong-to-an-entity-or-a-dictionary) | Advanced only |

## What reaches the AI

An entity reaches the AI only through a location. An entity in no location never reaches the AI.

| Field | Sent? |
|---|---|
| **Name** | Always |
| **Aliases** | Yes, as "also known as" |
| **Pronouns** | Yes, beside the name and aliases |
| **AI-Facing Description** | Yes. This is the main text the AI uses. |
| **AI-Facing Summary** | Only in prompt slots that ask for the short form |
| **Type** | Yes, as a plain field |
| **Player-Facing Description** | **Never** |
| Image, Image Tags, 3D model, group, order | Never |
| The **Persona** checkbox | Not as a field. It lets the player play as the entity. See [Personas for Authors](Persona-Authoring#make-an-entity-playable). |

> 💡 **The player reads only the Player-Facing Description, and the AI reads only the AI-Facing fields.** Put a secret in the **AI-Facing Description**. The narrator can act on it, and the player doesn't see it. The default prompt also asks the narrator not to use a name until the player can know it. That is a request to the AI, and the game doesn't enforce it.

## Descriptions and summaries

| Field | Who reads it | Notes |
|---|---|---|
| **Player-Facing Description** | The player, on the entity's card | Never sent to the AI, so it uses no context |
| **AI-Facing Description** | The AI | The full text. Put secrets here. |
| **AI-Facing Summary** | The AI | One line, for slots where the full text is too long. A blank summary is fine, and the game uses the full description in its place. |

The default prompt uses summaries for entities in *reachable* locations. It uses full descriptions for entities at the player's current location.

The **✨ toolbar** beside **AI-Facing Summary** can write a draft from your AI-Facing Description.

## Names and aliases

The game reads each page of narration to find which entities are present. It matches names and aliases.

**A name** matches this way:

| Name | Matches |
|---|---|
| One word, such as `Rose` | Only with a capital first letter. "She rose early" doesn't match. |
| Several words, such as `Emily Foster` | The words in order. One distinctive word with a capital also matches, so "Emily" is enough. A common word alone doesn't match. |
| Plurals | `Wolf` also matches "Wolves" |

**Aliases** are other names the entity uses: a title, a nickname, an epithet. The AI reads them as *"also known as"*. The game also counts the entity as present when the narration uses an alias.

| Rule | Example |
|---|---|
| **Case-sensitive** | `Matron` matches "the Matron" and doesn't match "the matron". Add each form the narration can write. |
| **Plurals match** | `wolf` also matches "wolves" |
| **Whole words only** | `Em` doesn't match inside "System" |

> ⚠️ **Never start an alias with "the".** Narration often puts a title at the start of a sentence, and "The alpha…" doesn't match the alias `the alpha`. Write `alpha`, which matches in both positions.

Two more rules:

- **Don't use general job titles.** `knight`, `alchemist` or `apprentice` match every person of that trade, and the wrong entity joins the scene.
- **Don't use a role the story gives to someone absent.** Quoted dialogue is ignored, but plain narration isn't. If the prose says *"she was sent by the Warchief"*, the alias `Warchief` marks the Warchief as present.

## Locations

Each entity stores its own locations in one field. The location's **Entities** picker shows the same link from the other side. Set it from either side.

> ⚠️ **When you delete a location, each entity that was there loses it, and nothing warns you.** The entities stay. But an entity that was only in that location is now in no location, so it never reaches the AI again. The entity still looks fine on its own tab.

The default prompt sends entities from three places, as separate blocks: the player's **current location**, its **sub-locations**, and **reachable** locations.

> ⚠️ **Each entity at the player's location is sent on every turn.** A crowded location uses context all the time. Two or three entities that matter to the scene are better than a full village.

## Openings

An entity can have its own openings, so it can start the scene in its own voice. See [Entity Openings](World-Editor-Openings#entity-openings).

## Groups

Groups are folders for you. Nesting and order are for the editor only and **never reach the AI**. A group can't change the story.

## Images and models

The image and the 3D model are for the player's screen. **Image Tags** are booru tags for AI image generation only. The ✨ toolbar can write a draft of the tags from the description. When you upload an image that has a prompt in its file, the editor offers to use that prompt. The narrator reads none of this.

An image field takes an uploaded file or a web address. See [Upload or link](World-Editor-Overview#upload-or-link).

## SillyTavern cards

Import a SillyTavern PNG card into your entity library, and it becomes an entity. The card's greetings become [Entity Openings](World-Editor-Openings#entity-openings):

| On the card | Becomes |
|---|---|
| **First message** | The entity's first Opening Narration |
| Each **alternate greeting** | One more Opening Narration, in card order, at weight 1 |
| The name macro, `{{char}}` | The entity's name |
| The user macro, `{{user}}` | The [Player Name chip](Persona-Authoring#the-player-name-chip) |

When these openings are in the draw, **Re-generate** on page one shows another greeting, like a swipe in SillyTavern. A card with no first message and no alternate greetings imports with no openings.

> 💡 **`{{user}}` stays in the stored text, as the Player Name chip.** The shown page says the persona's name, or "you" with no persona. The entity's descriptions and the card's lorebook keep the chip too, and there it reads "the player" with no persona.

## In the library

Open an entity in the library's **Entities** tab, and its editor has two tabs.

| Tab | What it holds |
|---|---|
| **Entity** | **Tags** in a column on the left. On the right, the **Profile**, **Descriptions** and **Openings** tabs, with the same fields as the World Editor. |
| **Placeholders** | The entity's own [placeholders](World-Editor-Placeholders), across the full width. |

The editor opens on **Entity** at **Profile**. The tags stay in view on all three tabs. On mobile, the tags show at the top of **Profile** only.

The library editor has no Simple or Advanced mode, so it always shows every tab.

## Getting started

Write the AI-Facing Description first. It's safe to put things there that the player shouldn't know yet. Add a summary only when the entity shows up in reachable locations. Use the Player-Facing Description for text the player reads and the AI doesn't need.
