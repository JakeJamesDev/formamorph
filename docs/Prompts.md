# 📜 Prompts
<!-- keywords: prompt engineering, templates, instructions sent, where is the tab, tab missing, ai behavior, writing style rules -->
<!-- route: settings.prompts -->

The **Prompts** tab in Settings holds the text the app sends to the AI for each request. A **prompt preset** is one full set of that text, with its per-prompt options. The app sends the prompts of the active preset.

The **Prompts** tab shows in **Advanced** mode only. To open it, open **Settings**, select **Advanced** in the switch next to the title, then open the **Prompts** tab.

> A prompt sends only what it holds. Text you delete is gone from the request, and a chip you delete sends nothing. See [The Chip Editor](#the-chip-editor).

## How to Make a Prompt Preset
<!-- keywords: create, new, copy, duplicate, custom, own, system, jailbreak, template, read only, locked, editing blocked, clone, fork, my version -->
<!-- route: settings.prompts -->

The built-in presets are read-only. To change a prompt, make your own preset first.

1. Open the **Prompts** tab.
2. Open the **Preset** list and select **Add New Preset…**.
3. Type a name in the **New Preset** dialog.
4. Select **Save**.

The new preset is a copy of the preset that was active, and it is now the active preset. To copy a preset in one step, select the **Duplicate** button next to the **Preset** list, or **Duplicate & Edit** on a read-only notice. The copy is named "*preset name* (copy)".

## How to Edit a Prompt
<!-- keywords: change, rewrite, customize, system, instructions, tweak, modify, writing style, tone, longer responses, ai behavior, rules, restore shipped text, preview result, second person, narrator personality -->
<!-- route: settings.prompts -->

1. Select your own preset in the **Preset** list.
2. In the list of prompts, select the prompt, such as **Choices**.
3. Under the prompt, select **System Prompt**, or **User Message** when the prompt has one.
4. Type in the editor. To add a value from the game, select a chip in the bar above the editor. See [The Chip Editor](#the-chip-editor).
5. Open the **Preview** tab to read the text with sample values in place of the chips.

The app saves each change at once. Under the editor, select **Compare** to see your changes against the shipped text. To go back to the shipped text, select **Reset**, then confirm. In the **Messages** view, each message has its own **Reset** and **Compare** beside its name.

## How to Route a Prompt to Another Endpoint
<!-- keywords: different model, second model, small model, faster, separate api, two models, per task, cheaper, multiple backends, mix providers, assign, split work, reachable, dual setup -->
<!-- route: settingsPromptSurfaces.options#prompt-endpoint -->

You can send one prompt to a different text endpoint, such as a small fast model for **Choices**. First add the endpoint as a preset on the **Endpoints** tab. See [Text](Settings#text).

1. Select your own preset in the **Preset** list.
2. Select the prompt, then the **Options** row under it.
3. Open the **Endpoint** list and select the endpoint preset.
4. Read the line under the list. **Reachable** means the endpoint answers. Select **Recheck** to try again.

To send the prompt to the active endpoint again, select **Use Active Endpoint**. A prompt route stays on this device. It is never in an exported or published preset.

## How to Share a Prompt Preset
<!-- keywords: export, import, copy code, send, file, json, friend, paste, transfer, give, load someone elses, string, another device -->
<!-- route: settings.prompts -->

1. Select the preset in the **Preset** list.
2. Select the **Export** button.
3. Select **Copy code** to copy a share code, or **Export .json** to save a file.

To add a preset that someone shared:

1. Select the **Import** button next to the **Preset** list.
2. Paste the share code, or select **Choose file…** and pick the `.json` file.
3. Read the warnings and the preset's Overview, then set its **Name**.
4. Select **Import**. When you selected the checkbox to overwrite a preset with the same name, the button reads **Overwrite**.

See [Sharing a Preset](#sharing-a-preset) for what a shared preset holds.

## How to Publish a Prompt Preset
<!-- keywords: upload, community, share online, post, public, listing, workshop, submit, models required, tags, publish blocked -->
<!-- route: settingsPromptPreset.overview -->

You must log in to Community Creations to publish. See [Login and Register](Community-Creations#login-and-register).

1. Select your own preset in the **Preset** list.
2. Select **Overview** at the top of the list of prompts.
3. Add at least one model to **Models**.
4. Fill in **Author**, **Description** and **Tags**.
5. Select **Publish**, then follow the publish dialog.

Without a model in **Models**, **Publish** opens **Add a Model**. Select **Open Overview** to go to the field.

## How to Use a Preset for One World
<!-- keywords: different prompts, specific, override, per world, only this scenario, assign, individual, folder wide, just one game, exception, global again -->
<!-- route: enterWorld -->

1. On the main menu, select the world.
2. In the world dialog, open the **Prompts** list.
3. Select a preset. **Use global preset** goes back to the preset that Settings has active.

That world now runs on the preset you picked. Your other worlds do not change. A library [Group](Library#groups) can also carry a preset, and the list then shows **Use group preset**. The world's own pick comes first.

While you play a world with its own preset, the **Prompts** tab edits that world's pick. A note under the **Preset** list tells you so.

---

## Prompt Presets
<!-- keywords: xml, experimental, which to choose, difference between, rename, delete, reset all, built in list, what is included, script warning -->
<!-- route: settings.prompts -->

The **Preset** list holds four built-in presets, then your own presets.

| Preset | What it is |
|---|---|
| **Default** | The shipped prompts, with Markdown headings |
| **Simple** | The same prompts, with plain labels in place of headings, and chips set to plain text |
| **XML** | The same prompts, with each section in an XML tag, and chips set to XML |
| **Experimental** | A short narration prompt that sends entity summaries and lets the AI look up full entries. See [The Experimental Preset](#the-experimental-preset). |

A built-in preset is read-only. Its editors show a lock notice with **Duplicate & Edit**. You can still read every prompt, and you can still switch Tools on and off for it in the **Tools** tab.

A preset holds:

- the text of every prompt and message
- each prompt's **Options**, except **Endpoint**, which only your own presets carry
- which Tools are on. See [Tools](Tools).
- the **Overview**, on your own presets

The icon buttons next to the **Preset** list manage your presets. Point at an icon to see its name. On a narrow screen they are in the **Preset Actions** menu.

| Button | What it does |
|---|---|
| **Duplicate** | Makes an editable copy named "*preset name* (copy)" and selects it. Built-in presets have it too. |
| **Rename** | Changes your preset's name |
| **Import** | Adds a preset from a share code or a `.json` file. See [How to Share a Prompt Preset](#how-to-share-a-prompt-preset). |
| **Export** | Opens the share code and the `.json` download. Built-in presets have it too. |
| **Publish** | Lists your preset in Community Creations. Shows while you are logged in. |
| **Reset** | Sets every prompt in your preset back to its shipped text |
| **Delete** | Removes your preset |

**Reset** and **Delete** ask you to confirm. Neither can be undone.

### The Experimental Preset

**Experimental** tests a different way to tell the AI about the entities. Its narration prompt sends a one-line summary of each entity, not the full description. The **get_entity** Tool is on, so the AI can fetch the full entry of an entity it writes about.

On an endpoint with no Tool support, the AI gets the summaries only. The narration then knows less about each entity than with **Default**. See [Endpoints Without Tool Support](Tools#endpoints-without-tool-support).

### Sharing a Preset

A share code and a `.json` file hold the same preset:

- the prompt text and the section style
- the tuning: samplers, reasoning, **Max Output**, **Include Attachments** and **Verbatim Turns**
- the **Overview**
- which Tools are on, and a copy of each of your own Tools that is on

A shared preset never holds a prompt's **Endpoint**. Endpoint presets exist only on your device.

The **Import Preset** dialog shows warnings before you import. A preset with a Script Tool warns you, because a script runs code when the AI calls it. Clear the tuning checkbox to import the prompt text only. When you already have a preset with that name, a checkbox offers to overwrite it. Without it, the import adds a separate copy.

### The Overview

**Overview** is the first row in the list of prompts. It shows on your own presets only. It describes the preset for other players when you publish it.

| Field | What it holds |
|---|---|
| **Author** | Who wrote the preset |
| **Description** | What the preset changes and how to use it |
| **Tags** | The preset's style and purpose |
| **Models** | The models the preset works well with. Publishing needs at least one, because players filter prompts by model. |

## The Prompts
<!-- keywords: what each does, pipeline, missing from list, not showing, director, storyboard, diary, scene tags, order of requests, which runs when -->
<!-- route: settingsPrompts.narration -->

The list on the left groups the prompts by the job they do. A prompt shows only while its feature is on. When you turn a feature off, its prompt is not in the list, and the app sends nothing for it.

| Prompt | Group | What it does in a turn | Shows while |
|---|---|---|---|
| **Narration** | Story | Writes the story text you read each turn | Always |
| **Planning** | Story | Plans the turn before narration writes it: who is present and what happens next | **Thinking** is **Planning** |
| **Director** | Story | Describes the scene first: who is here and what each entity is doing | **Thinking** is **Staged** |
| **Character** | Story | Runs once for each staged entity, after the director. States what that entity wants this turn, in the first person. | **Thinking** is **Staged** |
| **Discover Entity** | Story | Writes a lasting note for each new entity the story names. Runs after narration names a new entity. | **Describe New Characters** is on |
| **Storyboard** | Story | Merges the intentions of every staged entity into one plan, before narration | **Thinking** is **Staged** |
| **Choices** | Story | Writes your choices for the next turn, after narration | **Choices** is on |
| **Stat Updates** | Trackers | Reads the turn after narration and records which stats changed | **Stat Updates** is on |
| **Location Change** | Trackers | Decides after narration if your action takes you to a new location | **Location Change** is on |
| **Clock** | Trackers | Measures how much story time the turn took. Runs after narration. | **Measured Clock** is on |
| **Opening** | Trackers | Reads the opening scene once, at the start, to set the time of day | **Measured Clock** is on |
| **Summaries** | Memory | Condenses an older turn into one line that the AI can still read later. Runs when a turn is too old to go word for word. | **Memory Summaries** is on |
| **Milestone Select** | Memory | Decides between turns which summaries stay in long-term memory | **Memory Summaries** is on |
| **Diary** | Memory | Writes a private, first-person note from each present entity. Runs when a turn is too old to go word for word. | **Character Diaries** is on and **Thinking** is **Staged** |
| **Scene Tags** | Images | Tags the action of the scene for the [scene image](Image-Generation#scene-images), after narration | **Enable Image Generation** is on |

The settings in the last column are in Settings → **Output**, and **Enable Image Generation** is in Settings → **Endpoints** → **Image**. See [Settings](Settings). A line above each editor repeats what the prompt does.

## The Surfaces of a Prompt
<!-- keywords: anatomy, per prompt temperature, max length, history length, how many turns, reasoning budget, recap message, full request map, attachments option, thinking effort -->
<!-- route: settings.prompts -->

Select a prompt to open its **Anatomy**. The rows under the prompt open its other surfaces. On a narrow screen, one list at the top holds the prompts and the surfaces.

| Surface | What it holds | Which prompts have it |
|---|---|---|
| **Anatomy** | The request this prompt sends, built from your current settings | Every prompt |
| **System Prompt** | The instructions the AI reads first | Every prompt |
| **User Message** | The message that asks for the reply, such as your action | **Narration** with **Thinking** set to **Native**, **Choices**, **Stat Updates**, **Location Change**, **Clock**, **Opening**, **Summaries**, **Milestone Select**, **Director**, **Discover Entity**, **Scene Tags** |
| **Messages** | Extra lines in the narration history | **Narration**, while one of its messages is live |
| **Options** | Per-prompt settings | Every prompt |

The **View full screen** button opens the whole panel, with the list, in a large window.

### Anatomy

**Anatomy** shows the Request Anatomy: a labeled map of every message in the request this prompt sends. It uses your live settings. In a game, it uses that game's values. Outside a game, it uses sample values.

| Tab | What it shows |
|---|---|
| **Chips** | Your template, with each value as its chip. Dashed chips are parts the app fills in. Select one to open the prompt that writes it. |
| **Preview** | The full text of the request. The highlighted parts are text you typed. Select one to open the editor you typed it in. |

On a wide screen, a button shows **Chips** and **Preview** side by side. When your settings never send this request, **Anatomy** says so and shows nothing.

### System Prompt

The **System Prompt** is the main text of the prompt. It tells the AI its job and holds the chips for the world, the scene and the story so far. Edit it in [the chip editor](#the-chip-editor).

### User Message

The **User Message** is the last message of the request. It usually holds your action or the narration, and the task for this reply. **Narration** has it only while **Thinking** is **Native**. In the other thinking modes, the app writes that message itself.

### Messages

**Messages** holds the extra lines that **Narration** puts in its history. Each field shows when the app sends it, and has its own **Reset**.

| Message | Sent when |
|---|---|
| **Recap Message** | **Memory Summaries** has condensed older turns. It asks for the story so far, and the summaries answer it. |
| **Now Message** | At the end of the recap. It says where things stand now. |
| **Recall Message** | **Scene Recall** brings back an old turn. It marks the scene as the past. |
| **Direction Message** | Your action has text in `[square brackets]`, while **Thinking** is **Native**. It tells the AI the brackets are your direction as the author. |

A field shows only while its feature can send it.

### Options

**Options** holds the settings of one prompt. On a built-in preset they are read-only.

| Option | What it does | Shows on |
|---|---|---|
| **Endpoint** | Sends this prompt to an endpoint preset. **Use Active Endpoint** follows the **Endpoints** tab. See [How to Route a Prompt to Another Endpoint](#how-to-route-a-prompt-to-another-endpoint). | Every prompt |
| **Include Attachments** | Sends the images attached to your action with this prompt. On for **Narration** only, by default. | Prompts that send your action, while **Image Attachments** is on |
| **Max Output** | Caps the answer length of this prompt. Off shows **Auto** and the shipped cap. It does not cap reasoning. | **Planning**, **Director**, **Character**, **Storyboard**, **Choices**, **Discover Entity**, **Summaries**, **Milestone Select**, **Diary**, **Scene Tags** |
| **Verbatim Turns** | Sets how many recent turns go word for word. Older turns go as summaries. | **Narration**, **Planning**, **Choices**, **Stat Updates**, **Location Change**, **Summaries**, while **Memory Summaries** is on |
| **Native Reasoning** | Sets whether this prompt reasons, and how hard. Clear the checkbox and the prompt does no reasoning. **Global** follows **Native Reasoning** in Settings → **Output**. **Model Default** sends no hint. Where no **Reasoning Budget** slider shows, a readout gives the prompt's Thinking Room, such as "Low · 1,024 tok". | Endpoints whose model reasons. Not on **Narration** with **Thinking** set to **Inline**. |
| **Reasoning Budget** | Sets the reasoning tokens as a percent of the endpoint's **Max Output Tokens**. The answer keeps its full length. | Endpoints that take a token budget, such as the desktop engine and llama.cpp |
| **Custom Temperature** | Sets this prompt's temperature. Off shows the value the prompt sends now. | Every prompt |
| **Custom Repetition Penalty** | Sets this prompt's repetition penalty. Off shows the value the prompt sends now. | Every prompt |

**Reasoning Budget** needs **Max Output Tokens** on the prompt's endpoint. Without it, the slider goes away, and the strength's Thinking Room is the budget: Minimal 128, Low 1,024, Medium and Model Default 2,048, High 4,096, Extra High 8,192, Max 16,384 tokens. A model that always reasons keeps the **Native Reasoning** checkbox on, with a note.

## The Chip Editor
<!-- keywords: variables, macros, template tags, insert stats, curly braces, dynamic values, pill, pop out, blocks, fill in -->

Each prompt editor is a chip editor. A **chip** is a box in the text. When the app sends the request, it puts a value in each chip, such as the world description, the stats or your action.

- **A chip sends text, and no chip sends nothing.** The app adds nothing to a prompt that you did not place. Delete the **Notes** chip, and the AI never reads your notes.
- **The bar above the editor lists the chips this prompt can use.** Select a chip to put it at the cursor, or drag it into the text.
- **Select a placed chip to open Chip Options.** The dialog sets what the chip sends. See [Chip Options](#chip-options).
- **The editor has two tabs.** **Edit** holds the template. **Preview** shows the text with each chip filled in. Outside a game, a **Sample data** tag marks the sample values. **Preview** is off while the prompt has no chips.

The editor has **Undo** and **Redo** buttons. **Edit full screen** opens the editor in a large window. For the chips that carry the persona and names, see [Personas for Authors](Persona-Authoring).

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
| **Include** | **Entities**, **Persona** | Sends each entity's **Traits** and **Stats**, each on or off |
| **Stat Detail** | **Stats**, **Entities**, **Persona** | Sends **Range**, **Descriptor** and **Description** for each stat. At least one stays checked. |
| **Format** | **Stats**, **Traits**, **Location**, **Entities**, **Persona** | Shapes the text as **Simple**, **Markdown** or **XML** |
| **Mode** | **Dictionary** | Picks **Foreground** or **Background** lore |
| **Label**, **Header**, **Prepend**, **Append** | Placement fields, below a rule | **Header** starts a section. **Prepend** and **Append** wrap the value. A chip with no value sends none of them. |

- **Include Stats is on by default** for **Here** and **In Scene**. It is off for **In Sub** and **Reachable**.
- **Name content turns off Include and Stat Detail.** **Only With** still works, so the name list holds only the entities that pass.
- **Include Stats off turns off Stat Detail.**
- **A bare chip sends what it sent before.** Chips in saved presets and worlds keep working.

> ⚠️ **An older version of Formamorph can't read the new picks.** A preset or world that uses **Only With**, **Include** or **Stat Detail** picks shows the raw chip text there, and the AI reads it as text.

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
- **Include doesn't change who stays.** An entity with stats stays even when you clear **Include → Stats**.
- **The Persona chip has the same row.** A persona that fails the pick sends what no persona sends: `N/A`, or nothing when the chip has a **Header**, **Prepend** or **Append**.

## How to Get Entity Stats Into a Custom Stat Prompt
<!-- keywords: custom stat prompt, saved stat prompt, entity stats missing, stat updates skips entities, add entities chip, in scene chip, stat pass owner blocks, player character chip, global stats chip -->
<!-- route: chipOptions -->

The default **Stat Updates** prompt reads four blocks. A **Stat Updates** prompt you saved keeps its own chips, so it sends no entity stats until you add the **Entities** chip. The **Stats** chip sends no In Scene entity's stats.

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
- **A world's own Stats prompt follows the same steps.** See [World Prompts and the Diff Viewer](#world-prompts-and-the-diff-viewer).

## World Prompts and the Diff Viewer
<!-- keywords: custom prompt notice, compare, green and red, what changed, authors instructions, ignore, use mine instead, overrides my preset, raw, side by side -->
<!-- route: worldPrompts -->

A world can bring its own **Narration**, **Choices** or **Stats** prompt. An author writes them under **Custom Prompts** in the World Editor's **Overview** tab. See [World Editor Overview](World-Editor-Overview). A world prompt takes the place of your preset's prompt for that pass.

When you select such a world on the main menu, a notice under its details names the custom prompts, such as "This world uses a custom narration prompt." Select **View** on the notice to open **Custom Prompts**.

**Custom Prompts** compares the world's prompt with the prompt Formamorph ships for that pass. It does not compare with your own preset.

| Control | What it does |
|---|---|
| **Changes** | Shows one text with the changes marked. Added text is tinted green. Removed text is struck through in red. |
| **Raw** | Shows the world's prompt as the author wrote it |
| Pass tabs | **Narration**, **Choices** and **Stats**. Show when the world rewrites more than one pass. |

Chips show as their raw text, such as `<WORLD DESCRIPTION>`. To play the world with your own prompts, clear **Use this world's prompt** under the world's buttons on the main menu. See [The World Dialog](Starting-a-Game#the-world-dialog).

## Related

- [🧰 Tools](Tools): the functions the AI can call, and which preset turns them on
- [⚙️ Settings](Settings): the features that add or remove prompts, and the text endpoints
- [🧠 Story Memory](Memory): what **Summaries**, **Milestone Select** and **Diary** keep
