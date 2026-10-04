# 🪪 Personas for Authors
<!-- keywords: world creator side, player identity setup, who players become, designing the protagonist -->

How your world meets the player's persona: playable entities, the **Allowed Personas** and **Starts On** controls, the **Persona** chip, and the two Built-in chips that carry names into your text.

> Players read [Personas](Personas). This page covers the World Editor side. Everything here except the **Player Name** and **Character Name** chips is **Advanced mode only**.

---

## How to Make an Entity Playable
<!-- keywords: play as, character, player character, pov, selectable, let players be npc, premade heroes, pregens, controllable, protagonist option, roster of heroes, only when chosen -->
<!-- route: worldEditorEntity.profile -->

1. Switch the World Editor to Advanced mode.
2. Open the **Entities** tab, and select the entity.
3. On the **Profile** tab, find the **Persona** control and select **Playable**.
4. Optional: in **Starting Location**, pick where the player starts as this persona. **Automatic** uses the entity's first starting location.
5. Read the entity's descriptions, and the descriptions that mention it. Make sure each one is still correct when the player is this entity. See [Playable Entities](#playable-entities).

For an entity that exists only when the player picks it, select **Persona-Only** in step 3.

## How to Make a Custom Persona
<!-- keywords: player character, create your own, own character, name yourself, blank character, self insert, character creation, generic hero, give player a race, class for protagonist, builder at start, nameless template, player gets perks -->
<!-- route: worldEditor.entities -->

1. Switch the World Editor to Advanced mode.
2. Open the **Entities** tab, and add or select the entity. Name it, such as *Wanderer*.
3. On the **Profile** tab, select **Custom Persona** in the **Persona** control.
4. Open the **Traits** tab. The entity shows as a node at the top level.
5. Give it traits. Drag a top-level trait onto its node, or select a Blueprints trait or group and use **Link To…** in the footer.
6. Optional: give the entity [Self Openings](World-Editor-Openings#self-openings). They draw for a player with no world persona.

## How to Choose Who the Player Can Be
<!-- keywords: allowed, restrict, limit, character select, play as, starting character, allowed personas, force a protagonist, lock choices, ban outside characters, only my cast, whitelist, fixed hero, preselect for newcomers -->
<!-- route: worldEditor.overview -->

1. Switch the World Editor to Advanced mode.
2. Open the **Overview** tab.
3. In **Allowed Personas**, select **Any** or **World Only**.
4. In **Starts On**, pick the persona a new player starts on.

See [Persona Rules](#persona-rules) for each choice.

## How to Put a Name in Your Text
<!-- keywords: {{user}}, {{char}}, user, char, macro, placeholder, player, character, variable, insert token, curly braces, address reader directly, dynamic, auto fill, double brackets, mention the hero -->

1. Select a prose field, such as an entity's **AI-Facing Description** or an opening.
2. Type `{`. The menu opens with **Built-in** at the top.
3. Pick **Player Name** for the player's name, or **Character Name** for the name of the entity that owns the text.

The menu offers **Character Name** only in an entity's own fields. You can also type `{{user}}` or `{{char}}` in any prose field, and the field turns it into the chip.

## The Short Version
<!-- keywords: cheat sheet, quick reference, tldr, which option fits -->

| You want | Use |
|---|---|
| The player to play as one of your entities | **Playable** in the entity's **Persona** control |
| An entity that exists only when the player picks it | **Persona-Only** in the **Persona** control |
| Traits for a player with no world persona | **Custom Persona** in the **Persona** control |
| To decide who the player can be | **Allowed Personas** and **Starts On** on the **Overview** tab |
| Your own prompt to know the persona | The **Persona** chip |
| Your text to say the player's name | The **Player Name** chip |
| An entity's text to say its own name | The **Character Name** chip |

## Playable Entities
<!-- keywords: role options, role modes, what changes when chosen, text contradicts itself, proofread from hero view, dot on mode switch, leaves and returns -->

**Persona** on the entity's **Profile** tab is a control with four choices:

| Choice | The entity |
|---|---|
| **Cast** | Appears in the world as a regular entity. This is the default. |
| **Playable** | The player can play as it, or meet it in the world |
| **Persona-Only** | Appears only when the player picks it as their persona |
| **Custom Persona** | Becomes the persona the player creates. See [Custom Persona](#custom-persona). |

The library entity editor offers **Cast** and **Playable** only.

A **Playable** entity shows under **From This World** when a player enters your world. When a player picks it:

| What | Effect |
|---|---|
| The cast | The entity leaves it for that game. It returns when the player changes persona, unless it's [Persona-Only](#persona-only-entities). |
| Its traits | They're the player's traits, marked **You**. See [Entity Traits](World-Editor-Traits#entity-traits). |
| The AI | Reads that everyone in the world already knows this person, and that your text about the entity means the player |
| Starting location | The entity's **Starting Location** is preselected. With **Automatic**, its first location that is a starting location is. The player can change it. |
| [Entity Openings](World-Editor-Openings#entity-openings) | The entity's Others openings leave the draw, so page one never greets the player as themselves. Its [Self Openings](World-Editor-Openings#self-openings), if any, replace the whole draw. |

Only entities you select are playable. The setting is your statement that the entity reads correctly from the player's side.

> ⚠️ **Check text that names "the player" as someone else.** Suppose the blacksmith's description says "She distrusts the player". A player who plays the blacksmith now reads as someone who distrusts herself. The app doesn't rewrite this text. You own it when you make the entity playable. Read the entity's descriptions, and the descriptions that mention it, from the player's side first.

In Simple mode, a **Playable** or **Persona-Only** entity puts a dot on the **Advanced** side of the mode switch, so you know the world uses Advanced features.

## Persona-Only Entities
<!-- keywords: hidden unless chosen, never in the world, reserved for player, invisible character, exclusive hero, not offered in library -->

Some entities exist only as a player slot, such as a "Custom Character" with no story of their own. Set **Persona** to **Persona-Only** to keep one out of the world unless the player picks it.

| The player | The entity |
|---|---|
| Picks it | Is the player, the same as any playable entity |
| Picks someone else, or **None** | Isn't in the world. It's left out of the cast, scenes, diaries and the side panel. |

- **Its Others openings never draw.** When picked, it's the player. When not picked, it's absent.
- **Its Self openings draw when the player picks it.** They give a Persona-Only entity its own start.
- **The choice is in the World Editor only.** A library entity is never in a cast, so the library editor doesn't offer it.

## Custom Persona
<!-- keywords: greyed out choice, only one allowed, fallback traits, inherit race and class, unmark consequences, refuses group drop, duplicate loses role, replaces empty option -->

A player who picks a persona from their own library has no world entity's traits. A player who picks **None** has none either. The **Custom Persona** entity gives them traits anyway, such as a race and a class. It also stands in **None**'s place at Enter World.

Open the entity's **Profile** tab and set **Persona** to **Custom Persona**. The mark is the fourth choice, beside **Cast**, **Playable** and **Persona-Only**.

| Rule | Detail |
|---|---|
| One per world | While one entity holds the mark, the choice is disabled on every other entity. A hint names the holder. |
| Not in the cast | The mark takes the place of **Playable** and **Persona-Only**, and the entity acts as Persona-Only. It never joins a scene. |
| A normal entity | It owns traits, links and [copies](World-Editor-Placeholders#copies). You name it. |
| Stat traits | Its own traits can have **Stat Changes** and **Stat Availability**, the same as a **Playable** or **Persona-Only** entity's |
| Self openings | Its [Self Openings](World-Editor-Openings#self-openings) draw for a player who picks **None**, or a library persona with no Self openings of its own |
| At the top level | It stays at the top level of the **Traits** tab, in the order you set. A drop into a group is refused. |
| Always a bearer | The **Traits** and **Placeholders** tabs list it, so you can drag and link to it while it is empty. |
| Duplicate | A duplicate drops the mark. |

Its traits are the player's when the player picks **None** or a library persona. A world persona keeps its own traits. The picks carry over between **None** and library personas.

Copies work in the same order. A library persona's own copy wins. The Custom Persona entity's copy fills in where the persona has none. The [blueprint](World-Editor-Placeholders#blueprints) itself reads last.

Remove the mark, and the entity keeps its links, traits and copies. Its stat traits keep their stats, but the stats do nothing. A confirmation names the counts of links, traits and copies. Delete the entity, and they go with it. That confirmation names the counts of links, traits and placeholders. An empty entity does neither with a dialog.

A world with no marked entity keeps **None** as before. A blueprint chip then reads the blueprint's own values.

> 💡 **Enter World shows the entity in place of None.** Selecting it shows a **Name** and a **Description** field. The name the player enters replaces the entity's name in the story. The player's description follows yours, so the AI reads both your setup and the player's details. Your aliases stay.

See [Custom Persona](World-Editor-Traits#custom-persona) for how its links and pins work in the **Traits** tab.

## Persona Rules
<!-- keywords: block imported characters, permissions, enforce my cast, legacy setting converted, restriction ignored, returning player override -->

Two controls on the **Overview** tab decide who the player can be. Both are **Advanced mode only**.

**Allowed Personas** decides what the persona list offers:

| Value | The player can pick |
|---|---|
| **Any** | Your world's personas, their own library personas, and **None** (or your **Custom Persona**) |
| **World Only** | Your world's personas and your **Custom Persona**. No library personas. |

**Starts On** decides which persona a new player starts on, at Enter World and in **Quick Start**:

| Value | Starts on |
|---|---|
| **Player's Default** | The player's default persona. **World Only** hides this choice. |
| **None**, or your Custom Persona by name | No persona, or your **Custom Persona** when the world has one |
| One of your personas | That persona |

Use **Starts On: None** when your world already defines the player. Use **World Only** when the player must be one of your entities.

- **A pick the player made in your world before wins**, when the list still offers it. **Starts On** guides new players. It doesn't lock them.
- **World Only with no persona entity works like Any** until you give an entity a **Persona** role other than **Cast**.
- **A start persona you later unmark falls back to Player's Default.**
- **The side panel's Change list follows Allowed Personas** too.
- **Worlds saved with the older Persona Choice control load as the same rules.** Fixed becomes **Starts On: None**. Cast becomes **World Only**, and also **Starts On: None** when no entity was playable.

## The Persona Chip
<!-- keywords: ai forgets my name, inject player info, prompt variable, missing from custom prompt, shows not available, where to place it, detail level, cache friendly order -->

The **Persona** chip sends the persona to the AI. The built-in prompt presets already carry it.

> ⚠️ **Your own prompt gets no persona until you add the chip.** A prompt in **Custom Prompts** replaces the player's prompt, and nothing is added to it. Without the chip, the AI never sees the player's name or description. The same is true of a player's own custom preset.

Select the placed chip to open its pop-out and set **Content**:

| Content | Sends | Use it for |
|---|---|---|
| **Full** | Name, aliases, pronouns, full description and active traits | Prompts that write or plan the scene |
| **Summary** | The short AI summary, or the full description when there is none, and the names of its active traits | A shorter prompt |
| **Name** | The name and pronouns only, as plain text | Inside a sentence |

**Format** works as on the other list chips: **Simple**, **Markdown** or **XML**. **Name** sends plain text, so it locks **Format**.

| Detail | What to do |
|---|---|
| The heading | Write it in the chip's **Header** field. With no persona, the chip and its heading both send nothing, so no empty section is left. **Prepend** and **Append** text goes with the value the same way. A chip with no **Header**, **Prepend** or **Append** text sends `N/A`. |
| Placement | Put the chip beside the **Traits** chip, above **Location**. The persona rarely changes mid-game, and a stable top helps the AI server reuse its work. |
| A world persona | **Full** and **Summary** add the line that says the world knows this person. **Name** stays bare. |

Narration stays in second person, and entities say the player's name only after they learn it. Your prompt can state otherwise, for example that one entity already knows the player.

## The Player Name Chip
<!-- keywords: nameless reader wording, says the player, substitute word, grammar and capitals, not offered in field, older imports plain text, user macro -->

Type `{` in a prose field and pick **Player Name** under **Built-in**. It needs no placeholder of its own.

| The player has | In an opening | In world, entity and dictionary text |
|---|---|---|
| A persona | The persona's name | The persona's name |
| No persona | "you" | "the player" |

Both fallbacks take a capital at the start of a sentence. A possessive follows: "your", "the player's".

- **The chip works in both modes**, in every prose field with the `{` menu. Name and keyword fields don't offer it, and neither do the fields of **Custom Prompts**.
- **SillyTavern imports write it for you.** A card's or lorebook's `{{user}}` becomes this chip. See [SillyTavern cards](World-Editor-Entities#sillytavern-cards).
- **Text imported before the chip existed** keeps its plain "the player". Replace it by hand where you want the name.

> 💡 For what the chip does to page one, see [Openings](World-Editor-Openings).

## The Character Name Chip
<!-- keywords: self reference, name token, survives renaming, bot name macro, not in menu, inside trait text, owner of text -->

Type `{` in one of an entity's own fields and pick **Character Name** under **Built-in**. It reads as the name of the entity that owns the text. Write one description that names its owner, and it stays right after a rename.

- **The menu offers it only in an entity's own fields**, such as its descriptions and its openings. A book, a location or a world field doesn't offer it.
- **In trait text, type `{{char}}`.** It becomes the chip and names the trait's bearer. See [Entity Traits](World-Editor-Traits#entity-traits).
- **In trait text the player carries, it reads as Player Name.** A *Paladin* text then names each Paladin, the player included.
- **SillyTavern imports write it for you.** A card's `{{char}}` becomes this chip. In a card's embedded lorebook, `{{char}}` becomes the card's name as plain text.

## Related

- [🪪 Personas](Personas) — the player's side
- [🛠️ World Editor](WorldEditor) — [Openings](World-Editor-Openings), [Entities](World-Editor-Entities) and [Placeholders](World-Editor-Placeholders)
- [📐 World Format](WorldFormat) — the fields behind these controls
