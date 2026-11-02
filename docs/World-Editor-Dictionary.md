# 📖 World Editor: Dictionary
<!-- keywords: knowledge base, background facts, setting bible -->
<!-- route: worldEditor.dictionary -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

The Dictionary is your world's lorebook. Each **book** holds **entries**. When a keyword of an entry matches the scanned text, the entry activates, and its **Value** is injected into the AI's prompt.

## Why It Exists
<!-- keywords: save tokens, context too long, too much lore, only when relevant, on demand, big world -->

The AI can't keep your whole world in its context at one time. If you write every detail into your world's AI-Facing Description, you use that context on every turn, relevant or not.

A dictionary entry uses no context until a keyword matches. Mention the Gloamwater, and the AI receives the Gloamwater entry.

## How to Add a Dictionary Entry
<!-- keywords: lorebook, keywords, trigger, lore, new, create, world info, codex, encyclopedia, fact, define a term -->
<!-- route: worldEditor.dictionary#list-toolbar -->

1. Open the **Dictionary** tab.
2. If the world has no book yet, type a name in the **Filter Dictionaries** box. Select the **Add to Dictionary** icon button (+), then select **Add Dictionary**.
3. On the book's row, select **Add entry**. The new entry opens in the panel.
4. In **Trigger Keywords**, type a keyword and press Enter. Repeat for each keyword.
5. Write the text the AI gets in **Value**.
6. Select **Save**.

> 💡 A comma doesn't split keywords. When a keyword holds commas, the field offers to split it. A **Regex** entry gets no offer.

To add a dictionary from your library, select **Add to Dictionary**, then **Add From Library…**. **Import Dictionary…** in the same menu adds one from a file. It reads a Formamorph dictionary, a SillyTavern World Info file, or a character card's lorebook.

To check which entries activate for a scene, use the Test Bench's [Triggers](Test-Bench#triggers) tab.

## What Gets Scanned
<!-- keywords: not triggering, never fires, why didnt it activate, what text is checked, how far back, detection, ignored words -->

**If the AI reads it, it can activate an entry.** A **turn** is one action from you and the AI's reply. The game scans this text on each turn:

| Scanned | Always? |
|---|---|
| **The scene as the AI gets it**: your location and the entities present, plus the nearby and sub-location detail your prompt sends | Always |
| **Your notes** and the **action** you sent | Always |
| **Earlier turns**: your actions and the AI's narration | As far back as the entry's **Scan Depth** |

> 💡 Keywords match **the exact text the AI gets**. Where your prompt sends a *summary*, the game scans the summary. A keyword that is only in an entity's full description doesn't match when the AI got the short form. Check which form your prompt sends in Settings → [Prompts](Prompts) (Advanced mode only).

The scan covers the blocks your prompt uses. If you remove the location, entities or notes chip from your prompt, the game doesn't scan that block.

Text that is in **every** turn is **not scanned**: your world's AI-Facing Description, stats, traits and formatting guidance. Its words would activate entries on every turn.

An entry's Value doesn't activate other entries, unless the other entry is **Recursive**.

## The Entry Panel
<!-- keywords: constant, always on, regular expression, pattern, partial word, capital letters, two conditions, cascade, fires too often, must not contain -->
<!-- route: worldEditor.dictionary -->

Select an entry to open its panel. **Trigger Keywords** and **Value** are all most entries need. Each other control solves one specific problem.

| Tab | Holds | Mode |
|---|---|---|
| **Details** | **Name**, **Trigger Keywords**, **Whole Words**, **Case-Sensitive** and **Value** | Simple and Advanced |
| **Matching** | **Always Inject**, **Regex**, **Recursive**, **Scan Depth** and **Secondary Keywords** | Advanced only |

Simple mode also hides the Background and Foreground groups and the **Enabled** switches. A dictionary edited [in the library](#in-the-library) always shows every control.

Use the **Matching** tab only when an entry activates at the wrong time, or doesn't activate at the right time.

### Details

| Field | What it does |
|---|---|
| **Name** | Names the entry in the list, and goes before the Value in the prompt. When it's blank, the game uses the first Trigger Keyword. |
| **Trigger Keywords** | Press Enter after each keyword. One match is enough to activate the entry. |
| **Whole Words** | Matches complete words only, so *art* doesn't match inside *cart*. Works with **Regex** too. |
| **Case-Sensitive** | Off by default |
| **Value** | The text injected into the prompt |

### Matching

| Control | What it does |
|---|---|
| **Always Inject** | Skips the scan and sends the entry on every turn. It uses context on every turn, so use it rarely. |
| **Regex** | Reads each keyword as a regular expression. An invalid expression never matches. |
| **Recursive** | The Values of entries that already activated can also activate this entry. The chain stops after 3 passes. |
| **Scan Depth** | How many earlier messages the game scans. Blank scans all of them. `0` scans only the current scene. |
| **Secondary Keywords** | A second condition. *bridge* activates the entry only when *toll* is also in the scanned text. |

Two checkboxes change the **Secondary Keywords** test:

| Checkbox | What it does |
|---|---|
| **Require All** | Every secondary keyword must match, not only one |
| **Exclude** | Reverses the test. The entry activates only when the secondary keywords are **absent**. |

> ⚠️ **An invalid Regex keyword with Exclude on always passes the test.** Check your expression.

## Semantic Lore
<!-- keywords: by meaning, embedding, vector, fuzzy, smart match, synonyms, without exact word, similar wording -->

**Semantic Lore** is a player setting in [Settings](Settings#lore) → **Output** → **Lore**, in Advanced mode. It is off by default. It activates entries by meaning, after the keyword scan. Write *"the ruined tower"*, and an *Old Beacon* entry can activate with no keyword present.

- **It only adds entries.** Keyword activation doesn't change.
- **It compares entries with your action.** It skips **Always Inject** entries.
- **It uses the same on-device model as Semantic Memory.** The model is about 23 MB, and it downloads the first time you turn the setting on.

## Background and Foreground
<!-- keywords: position in prompt, insertion order, before or after, top or bottom, move between sections, nothing is sent, placement -->

Each book shows its entries in two groups that collapse, **Background** and **Foreground**. They are two separate lore blocks in the system prompt. An entry's group decides which block it joins. A new entry starts in Foreground.

**To move an entry, drag it from one group into the other.** There is no dropdown.

By default, Background comes earlier in the prompt than Foreground. A prompt chip fills each block, so you set the position:

- **Move the chips in the prompt editor** to move the blocks.
- **A prompt with only one of the two chips** sends the entries of both groups in that chip.
- **A prompt with neither chip** sends no lore.

## Books
<!-- keywords: multiple lorebooks, disable whole set, player turns off, reorder, split by topic -->
<!-- route: worldEditorBook.details -->

Books group related entries. The order of the books sets the order of the injected entries. Disable a book to turn off every entry in it.

A book's **Enabled** state is a *default*. The player can change it.

- **Before a game starts, the player can get a step to enable, disable and reorder your books.** The step also lists the dictionaries from the player's own library. See [Library Additions](Starting-a-Game#library-additions).
- **The step shows only when there's a choice to make.** The world has more than one book, or the player's library has one dictionary at least.

Select a book in the tree to open its panel. It has two tabs.

| Tab | What it holds |
|---|---|
| **Details** | **Name**, **Description**, the entry count and, in Advanced mode, **Enabled**. The Description is a note for you and never reaches the AI. |
| **Placeholders** | The book's own [placeholders](World-Editor-Placeholders), across the full panel. **Advanced mode only.** |

In Simple mode the panel shows the Details fields with no tabs. The tab you pick stays open when you select another book.

## In the Library
<!-- keywords: standalone lorebook, reusable across worlds, cover, edit outside world, my lorebooks, rename -->
<!-- route: dictionaryEditor -->

A dictionary in your library is always one book, so its editor has no row for the book. It has three tabs.

| Tab | What it holds |
|---|---|
| **Overview** | Everything about the book: **Author**, **Tags** and **Cover Image**, beside **Name** and **Description**. |
| **Dictionary** | The entries only. The **Add entry** icon button (+) at the top of the list adds one. |
| **Placeholders** | The book's own [placeholders](World-Editor-Placeholders), across the full width. |

The editor opens on **Dictionary** with the first entry selected. An empty book shows a hint beside **Add entry**. Rename the book on **Overview**. The rename changes no world.

