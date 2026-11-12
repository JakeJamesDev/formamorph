# 🔣 Prompt Chips
<!-- keywords: insert game data, prompt template values, what gets filled in, boxes in the prompt -->
<!-- route: chipOptions -->

A **chip** is a box in a prompt's text. When the app sends the request, it puts a value in each chip. A value can be the world description, the stats or your action. This page shows how to place chips and set what each one sends.

To open a prompt for editing, see [How to Edit a Prompt](Prompts#how-to-edit-a-prompt).

## The Chip Editor
<!-- keywords: variables, macros, template tags, insert stats, curly braces, dynamic values, pill, pop out, blocks, fill in -->

Each prompt editor is a chip editor.

- **A chip sends text, and no chip sends nothing.** The app adds nothing to a prompt that you did not place. Delete the **Notes** chip, and the AI never reads your notes.
- **The bar above the editor lists the chips this prompt can use.** Select a chip to put it at the cursor, or drag it into the text.
- **Select a placed chip to open Chip Options.** The dialog sets what the chip sends. See [Chip Options](#chip-options).
- **The editor has two tabs.** The **Edit** tab holds the template. The **Preview** tab shows the text with each chip filled in. Outside a game, a **Sample data** tag marks the sample values. **Preview** is off while the prompt has no chips.

The editor has **Undo** and **Redo** buttons. **Edit full screen** opens the editor in a large window. For the chips that carry the persona and names, see [Personas for Authors](Persona-Authoring).

| Chip | Offered in |
|---|---|
| **World**, **Stats**, **Traits**, **Persona**, **Location**, **Entities**, **Inventory**, **Notes**, **Time** | Every System Prompt |
| **Dictionary**, **Length Guidance**, **Markdown Guidance** | **Narration** |
| **Language** | **Narration** and **Choices**. It carries the **AI Language** setting, and sends nothing for English. |
| **Active Character Guidance** | **Director** |
| **Character** | **Character**, and the User Message of **Discover Entity** |
| **Player Action** | User Messages that send your action |
| **Narration** | User Messages that send the turn's narration |
| **In Frame** | The User Message of **Scene Tags** |
| **First Passage**, **Later Material** | The User Message of **Discover Entity** |
| **Remembered Moments**, **New Moments** | The User Message of **Milestone Select** |

> 💡 **Entity Location** asks about every entity in one request, and the game adds each entity's state and answers after the User Message. An older template's **Move State** and **Move Options** chips send nothing, and its **Character** chip sends "each character listed".

The **Now Message** offers **Location**, **Entities**, **Time** and **Notes**.

## Chip Options
<!-- keywords: chip settings, chip popup, pop out, options for a chip, what does this chip send, what the ai reads, scope content format, header prepend append, only with, include, stat detail -->
<!-- route: chipOptions -->

**Chip Options** is a dialog with the settings of one placed chip. It shows only the rows that chip has.

- **A prompt chip has two panes.** The left pane holds the rows. The right pane, **What the AI Reads**, shows the text the chip sends with your picks. It includes the **Header**, **Prepend** and **Append** text, in a dimmer shade.
- **Hover or focus a row to see what it adds.** The text it adds lights up, and the rest dims. A **Stat Detail** piece lights only its own part of each stat line.
- **The pane reads real data where it can.** In a game it reads the live scene. In the World Editor it reads the authored world. In Settings it reads sample data.
- **Placeholder chips and Tool argument chips have one pane.** They show their rows and no **What the AI Reads**.
- **A narrow screen stacks the panes.** The rows come first.
- **A list of four options or more is a dropdown.** A short list is a row of buttons. Hover an option to read what it does.
- **Read-only presets show every row, disabled.**
- **Re-Pick…** aims a placeholder chip at another value. **Edit Value** opens the chip's value for typing.

| Row | Chips | What it does |
|---|---|---|
| **Scope** | **Location**, **Entities** | Picks which locations or entities the chip lists |
| **Only With** | **Entities**, **Persona** | Keeps only entities that own **Stats**, **Traits** or either |
| **Content** | **Location**, **Entities**, **Persona** | Sends **Full** detail, a **Summary**, or the **Name** only |
| **Content** | **Traits** | Sends each trait's **Description**, or the **Name** only, one per line under its group heading |
| **Include** | **Entities**, **Persona** | Sends each entity's **Traits** and **Stats**, each on or off. On **Entities**, **Movement** sends whether a character follows the player, waits, or can't leave right now. |
| **Stat Detail** | **Stats**, **Entities**, **Persona** | Sends **Range**, **Descriptor** and **Description** for each stat. With all three off, the chip sends stat names only. |
| **Format** | **Stats**, **Traits**, **Location**, **Entities**, **Persona**, **Inventory** | Shapes the text as **Simple**, **Markdown** or **XML** |
| **Mode** | **Dictionary**, placeholder chips | Picks **Foreground** or **Background** lore. On a placeholder chip, picks **World** or **Unique**. |
| **Label** | Placeholder chips set to **Unique** | Names the chip |
| **Header**, **Prepend**, **Append** | Placement fields, below a rule | **Header** starts a section. **Prepend** and **Append** wrap the value. A chip with no value sends none of them. |

- **Include Stats is on by default** for **Here** and **In Scene**. It is off for **In Sub**, **Reachable** and **Known**.
- **Name content turns off Traits, Stats and Stat Detail.** **Only With** and **Movement** still work, so the name list holds only the entities that pass.
- **Movement is on by default.** An entity beside the player reads as following, waiting or staying. One in a nearby place reads as staying when it can't leave right now. A Generic entity gets no tag.
- **Include Stats off turns off Stat Detail.**
- **A chip with no picks sends its default text.**

> ⚠️ **An older version of Formamorph can't read these picks.** A preset or world that uses **Only With**, **Include** or **Stat Detail** picks shows the raw chip text there, and the AI reads it as text.

## The Inventory Chip
<!-- keywords: inventory chip, items in the prompt, what the narrator knows about items, equipped items, carried items, hidden items, items here -->

The **Inventory** chip tells the AI who has which items in the scene. In a world with Currencies, it also gives each priced item's worth and how much money the player and each entity have.

| Who | What it sends |
|---|---|
| 🧍 You, and each entity at your location | Each equipped item with its **AI-Facing Summary** (or its **AI-Facing Description** when there is no summary), then the carried items by name |
| 📍 The current location | The items that lie there, by name |

- **Hidden items are marked hidden.** The chip sends where they are, so the AI can reveal one when you search.
- **A stack shows its count**, such as ×3.
- **When you, the entities here and the location hold no items, the chip sends `N/A`.** With a **Header**, **Prepend** or **Append**, it sends nothing.
- **The built-in presets hold it in the narration prompt.** A preset you made keeps its prompts as you saved them. To add the chip, select **Inventory** in the bar above the editor.

## How to Send Only Entities With Stats
<!-- keywords: only entities with stats, only npcs with stats, filter entities by stats, skip entities without stats, send only characters that own stats, entities that have traits, keep cast short, trim the entity list, stat pass cast -->
<!-- route: chipOptions -->

Use **Only With** on the **Entities** chip. The chip then lists only the entities that own stats.

1. In the prompt, select the **Entities** chip. Chip Options opens.
2. Under **Only With**, check **Stats**.
3. Optional: check **Traits** too. The chip then keeps an entity that owns stats or traits.
4. Read **What the AI Reads** to check the list.

- **The chip shows a filter icon while a pick is on.** Hover the icon to read the picks, such as "Only With Stats or Traits". The chip's label does not change.
- **An entity owns stats when at least one of its stats is on.** The same holds for traits. A switched-off stat or trait doesn't count.
- **Include doesn't change which entities stay.** An entity with stats stays even when you clear **Include → Stats**.
- **The Persona chip has the same row.** A persona that fails the pick sends the same as no persona: `N/A`, or nothing when the chip has a **Header**, **Prepend** or **Append**.

## How to Get Entity Stats Into a Custom Stat Prompt
<!-- keywords: custom stat prompt, saved stat prompt, entity stats missing, stat updates skips entities, add entities chip, in scene chip, stat pass owner blocks, player character chip, global stats chip -->
<!-- route: chipOptions -->

The default **Stat Updates** prompt reads four blocks. A **Stat Updates** prompt you saved keeps its own chips. It sends no entity stats until you add the **Entities** chip. The **Stats** chip sends no In Scene entity's stats.

| Chip | Header | Sends |
|---|---|---|
| **Stats** | Global Stats | Global stats that no entity owns |
| **Traits** | Global Traits | Global traits that no entity owns |
| **Persona** | Player Character | The persona's traits and stats, and the stats of every entity you play as |
| **Entities** | In Scene | Each present entity that owns stats |

1. Open the **Prompts** tab in Settings, in **Advanced** mode. Select **Stat Updates** in a preset of your own.
2. Put the cursor after your **Persona** chip. Select the **Entities** chip in the bar.
3. Select the placed chip to open Chip Options.
4. Set **Scope** to **In Scene**.
5. Under **Only With**, check **Stats**.
6. Set **Content** to **Summary**. Under **Include**, check **Traits** and **Stats**. Under **Stat Detail**, check all three pieces.
7. In **Header**, type `In Scene`.
8. In the format section of the prompt, add a line that lists the reply keys: `Player Character`, `Global Stats` and each In Scene entity's name.

- **An entity's reply key is its name, as the block shows it.** A name that clashes with an earlier owner reads as "*name* (2)".
- **Set the Persona chip's Only With, Content and Include rows the same way.** Keep its **Header** as `Player Character`. A persona with no stats sends no block.
- **A world's own Stats prompt follows the same steps.** See [World Prompts and the Diff Viewer](Prompts#world-prompts-and-the-diff-viewer).

## Related

- [📜 Prompts](Prompts): prompt presets, what each prompt does, and a world's own prompts
- [🎭 Entities](World-Editor-Entities): what the **Entities** chip lists
- [📊 Stats](World-Editor-Stats): the stat pieces that **Stat Detail** sends
