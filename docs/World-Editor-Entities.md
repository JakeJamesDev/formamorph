# 🎭 World Editor: Entities

> 🛠️ Part of the [World Editor](WorldEditor) guide.

The people, creatures and things that populate your world — a ferryman, an eel-smoker, a barred door. An entity belongs to one or more **Locations**, and the AI is handed the ones that could turn up where the player is.

## Why it exists

Left to itself, the narrator invents a stranger, names them, and forgets both by the next turn. An entity is a fixed, reusable character the story can return to — one the AI is reminded of every time the player is somewhere it lives.

The default prompt introduces them under "Characters and things that **may** appear in this location". That hedge is a hint to the AI, not a rule the app enforces — nothing stops the narrator reaching for anyone on the list, and the wording is yours to change in the prompt editor.

## What reaches the AI

Assignment to a location is the entire gate: an entity in no location never reaches the AI at all.

| Field | Sent? |
|---|---|
| **Name** | Always |
| **Aliases** | Yes — as "also known as" |
| **Pronouns** | Yes, beside the name and aliases |
| **AI-Facing Description** | Yes — the main thing the AI knows |
| **AI-Facing Summary** | Only in prompt slots that ask for the short form |
| **Type** | Yes, as a plain field |
| **Player-Facing Description** | **Never** |
| Image, Image Tags, 3D model, group, order | Never |
| The **Persona** checkbox | Not as a field. It lets the player play as the entity: see [Personas for Authors](Persona-Authoring#make-an-entity-playable). |

> 💡 **The two descriptions are disjoint, and that's the point.** The player only ever sees the Player-Facing one; the AI only ever sees the AI-Facing one. So the **AI-Facing Description** is where a secret lives — the narrator can act on it while the player stays in the dark. The default prompt even asks the narrator to hold a name back until the player would plausibly have learned it, though that's a request to the AI rather than something the app enforces.

## Descriptions and summaries

Three description fields, with distinct jobs:

- **Player-Facing Description** — what the player reads on the entity's card. Never sent to the AI, so it costs no context; whatever you write here, the player simply knows.
- **AI-Facing Description** — the full text the AI works from, and the player never sees it. This is the one that does the work, and the one a secret goes in.
- **AI-Facing Summary** — a one-line version for slots where the full description is too long. **Blank is fine** — it falls back to the full description. The default prompt uses summaries for entities in *reachable* locations, and full descriptions for the player's current location.

The **✨ toolbar** beside AI-Facing Summary can draft it from your AI-Facing Description.

## Aliases

Other names the entity goes by — a title, a nickname, an epithet. They do two jobs: the AI is told them as *"also known as"*, and the story parser counts the entity as **present** when the narration uses one, not just when it uses the real name.

| | |
|---|---|
| **Case-Sensitive** | `Matron` matches "the Matron" and misses "the matron". Add every casing narration is likely to write. |
| **Plural-aware** | `wolf` also matches "wolves", the same as names. |
| **Whole Words** | `Em` won't fire inside "System". |

> ⚠️ **Never start an alias with "the".** Narration puts a title at the start of a sentence constantly, and "The alpha…" won't match an alias written `the alpha`. Drop the article — `alpha` matches both positions.

Two more worth knowing:

- **Skip generic job titles.** `knight`, `alchemist`, `apprentice` will fire on any passing character of that trade and pull the wrong entity into the scene.
- **Don't alias a role the story uses for someone off-page.** Quoted dialogue is excluded from presence detection, but plain narration isn't — so if the prose says *"she was sent by the Warchief"*, an alias of `Warchief` marks the Warchief present in a scene she isn't in.

## Locations

The link lives on the **entity**: one character's whereabouts is one field, however many places it turns up in. The location's own Entities picker is the same relationship seen from the other end — set it wherever you prefer.

> ⚠️ **Deleting a location removes it from everyone who was there, silently.** The entities themselves survive — but one that was only in that location is now in no location, which means it never reaches the AI again. Nothing warns you, and the entity still looks fine in its own tab.

The default prompt feeds entities from three places, as separate blocks: the player's **current location**, its **sub-locations**, and **reachable** locations.

> ⚠️ Every entity at the player's location is sent **every turn**. A crowded location is a permanent context bill — two or three that the scene turns on beat a populated village.

## Openings

An entity can have its own openings, so it can start the scene in its own voice. See [Entity Openings](World-Editor-Openings#entity-openings).

## Groups

Folders for your own sanity. Nesting and order are editor-only and **never reach the AI** — entities feed the AI exactly as if ungrouped, so grouping can never change the story.

## Images and models

The image and 3D model are for the player's screen. **Image Tags** are booru tags used only for AI image generation — the ✨ toolbar can draft them from the description, and uploading an image with an embedded prompt offers to use it. None of this reaches the narrator.

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

Write the AI-Facing Description first — it's the one that does the work, and it's safe to put things there the player shouldn't know yet. Add a Summary only if the entity turns up in reachable locations. Reach for the Player-Facing Description when you want the player to read something the AI has no use for.
