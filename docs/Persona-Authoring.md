# 🪪 Personas for Authors

How your world meets the player's persona: playable entities, the **Persona Choice** control, and the two chips that carry the player into your text.

> Players read [Personas](Personas). This page covers the World Editor side. Everything here except the **Player Name** chip is **Advanced mode only**.

---

## The Short Version

| You want | Use |
|---|---|
| The player to play as one of your entities | The **Persona** checkbox on that entity |
| To decide who the player can be | **Persona Choice** on the **Overview** tab |
| Your own prompt to know the persona | The **Persona** chip |
| Your text to say the player's name | The **Player Name** chip |

## Make an Entity Playable

Open the entity's **Profile** tab and select the **Persona** checkbox. The entity then shows under **From This World** when a player enters your world.

When a player picks it:

| What | Effect |
|---|---|
| The cast | The entity leaves it for that game. It returns when the player changes persona. |
| The AI | Reads that everyone in the world already knows this person, and that your text about the entity means the player |
| Starting location | The entity's first location that is a starting location is preselected. The player can change it. |
| [Entity Openings](WorldEditor#entity-openings) | The entity's own openings leave the draw, so page one never greets the player as themselves |

Only entities you select are playable. The checkbox is your statement that the entity reads correctly from the player's side.

> ⚠️ **Check text that names "the player" as someone else.** Suppose the blacksmith's description says "She distrusts the player". A player who plays the blacksmith now reads as someone who distrusts herself. The app doesn't rewrite this text. You own it when you select the checkbox. Read the entity's descriptions, and the descriptions that mention it, from the player's side first.

A selected **Persona** checkbox turns on the notice beside the mode switch.

## Persona Choice

The **Overview** tab has a **Persona Choice** control with three values.

| Value | At Enter World | **Quick Start** |
|---|---|---|
| **Open** | Any persona, or **None**. Starts on the player's default persona. | The player's default persona |
| **Fixed** | Starts on **None**. The player can still pick. | **None** |
| **Cast** | Only your world's personas, with no **None**. Starts on the first one. | The first one |

Use **Fixed** when your world already defines the player. Use **Cast** when the player must be one of your entities.

- **A pick the player made in your world before wins**, when the list still offers it. The control guides the player. It doesn't lock them. In a **Cast** world, an earlier **None** or library pick isn't offered, so the first persona is used.
- **Cast with no playable entity works like Fixed** until you select **Persona** on an entity.
- **A world with no value is Open**, so older worlds play as before.
- **The side panel's Change list follows the same rule** as Enter World.

## The Persona Chip

The **Persona** chip sends the persona to the AI. The built-in prompt presets already carry it.

> ⚠️ **Your own prompt gets no persona until you add the chip.** A prompt in **Custom Prompts** replaces the player's prompt, and nothing is added to it. Without the chip, the AI never sees the player's name or description. The same is true of a player's own custom preset.

Select the placed chip to open its pop-out and set **Content**:

| Content | Sends | Use it for |
|---|---|---|
| **Full** | Name, aliases, pronouns and full description | Prompts that write or plan the scene |
| **Summary** | The short AI summary, or the full description when there is none | A shorter prompt |
| **Name** | The name and pronouns only | Inside a sentence |

**Format** works as on the other list chips: **Simple**, **Markdown** or **XML**.

| Detail | What to do |
|---|---|
| The heading | Write it in the chip's **Prepend** field, with a line break after it. With no persona, the chip and its heading both send nothing, so no empty section is left. A chip with no **Prepend** or **Append** text sends `N/A`. |
| Placement | Put the chip beside the **Traits** chip, above **Location**. The persona rarely changes mid-game, and a stable top helps the AI server reuse its work. |
| A world persona | **Full** and **Summary** add the line that says the world knows this person. **Name** stays bare. |

Narration stays in second person, and characters say the player's name only after they learn it. Your prompt can state otherwise, for example that one entity already knows the player.

## The Player Name Chip

Type `{` in a description, dictionary or opening field and pick **Player Name**. It needs no placeholder of its own.

| The player has | In an opening | In world, entity and dictionary text |
|---|---|---|
| A persona | The persona's name | The persona's name |
| No persona | "you" | "the player" |

Both fallbacks take a capital at the start of a sentence. A possessive follows: "your", "the player's".

- **The chip works in both modes**, in every prose field with the `{` menu. Name and keyword fields don't offer it.
- **SillyTavern imports write it for you.** A card's or lorebook's `{{user}}` becomes this chip. See [SillyTavern cards](WorldEditor#sillytavern-cards).
- **Text imported before the chip existed** keeps its plain "the player". Replace it by hand where you want the name.

> 💡 For what the chip does to page one, see [Openings](WorldEditor#openings).

## Related

- [🪪 Personas](Personas) — the player's side
- [🛠️ World Editor](WorldEditor) — [Openings](WorldEditor#openings), [Entities](WorldEditor#entities) and [Placeholders](WorldEditor#placeholders)
- [📐 World Format](WorldFormat) — the fields behind these controls
