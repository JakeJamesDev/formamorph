# 📖 World Editor: Dictionary

> 🛠️ Part of the [World Editor](WorldEditor) guide.

The Dictionary is your world's lorebook. Each **book** holds **entries**. When a keyword of an entry matches the scanned text, the entry activates, and its **Value** is injected into the AI's prompt.

## Why it exists

The AI can't keep your whole world in its context at one time. If you write every detail into your world description, you use that context on every turn, relevant or not.

A dictionary entry uses no context until a keyword matches. Mention the Gloamwater, and the AI knows what it is.

## What gets scanned

The rule: **if the AI reads it, it can activate an entry.** A **turn** is one action from you and the AI's reply. On each turn, the game scans:

| Scanned | Always? |
|---|---|
| **The scene as the AI gets it**: your location and the entities present, plus the nearby and sub-location detail your prompt sends | Always |
| **Your notes** and the **action** you sent | Always |
| **Earlier turns**: your actions and the AI's narration | As far back as the entry's **Scan Depth** |

> 💡 Keywords match **the exact text the AI gets**. Where your prompt sends a *summary*, the game scans the summary. A keyword that is only in an entity's full description doesn't match when the AI got the short form. Check which form your prompt sends in **Settings → Output → Turn Extras**.

The scan covers the blocks your prompt uses. If you remove the location, entities or notes chip from your prompt, the game doesn't scan that block.

Text that is in **every** turn is **not scanned**: your world description, stats, traits and formatting guidance. Its words would activate entries on every turn.

An entry's Value doesn't activate other entries, unless the other entry is **Recursive**.

## The entry panel

Select an entry to open its panel. **Trigger Keywords** and **Value** are all most entries need. Each other control solves one specific problem.

| Tab | Holds | Mode |
|---|---|---|
| **Details** | **Name**, **Trigger Keywords**, **Whole Words**, **Case-Sensitive** and **Value** | Simple and Advanced |
| **Matching** | **Always Inject**, **Regex**, **Recursive**, **Scan Depth** and **Secondary Keywords** | Advanced only |

Simple mode also hides the Background and Foreground groups and the **Enabled** switches.

### Details

| Field | What it does |
|---|---|
| **Name** | Names the entry in the list, and goes before the Value in the prompt. When it's blank, the game uses the first Trigger Keyword. |
| **Trigger Keywords** | Press Enter after each keyword. One match is enough to activate the entry. |
| **Whole Words** | Matches complete words only, so *art* doesn't match inside *cart*. **Regex** ignores this checkbox. |
| **Case-Sensitive** | Off by default |
| **Value** | The text injected into the prompt |

### Matching

| Control | What it does |
|---|---|
| **Always Inject** | Skips the scan and sends the entry on every turn. It uses context on every turn, so use it rarely. |
| **Regex** | Reads each keyword as a regular expression. An invalid expression never matches. |
| **Recursive** | The Values of entries that already activated can also activate this entry |
| **Scan Depth** | How many earlier messages the game scans. Blank scans all of them. `0` scans only the current scene. |
| **Secondary Keywords** | A second condition. *bridge* activates the entry only when *toll* is also in the scanned text. |

Two checkboxes change the **Secondary Keywords** test:

| Checkbox | What it does |
|---|---|
| **Require All** | Every secondary keyword must match, not only one |
| **Exclude** | Reverses the test. The entry activates only when the secondary keywords are **absent**. |

> ⚠️ **An invalid Regex keyword with Exclude on always passes the test.** Check your expression.

## Semantic Lore

**Semantic Lore** is an experimental player setting. It activates entries by meaning, after the keyword scan. Write *"the ruined tower"*, and an *Old Beacon* entry can activate with no keyword present. It only adds entries. Keyword activation doesn't change.

## Background and Foreground

Each book shows its entries in two groups that collapse, **Background** and **Foreground**. They are two separate lore blocks in the system prompt. An entry's group decides which block it joins. A new entry starts in Foreground.

**To move an entry, drag it from one group into the other.** There is no dropdown.

By default, Background comes earlier in the prompt than Foreground. **You control the position**: a prompt chip fills each block, and you can move the chips in the prompt editor. If your prompt has only one of the two chips, that chip gets the entries of both groups. If it has neither chip, no lore is sent.

## Books

Books group related entries. The order of the books sets the order of the injected entries. Disable a book to turn off every entry in it.

A book's **Enabled** state is a *default* that the player can change. Before a game starts, the player can get a step that lets them enable, disable and reorder your books, together with the dictionaries from their own library. The step shows only when there's a choice to make: the world has more than one book, or the player's library has one dictionary at least.

Select a book in the tree to open its panel. It has two tabs.

| Tab | What it holds |
|---|---|
| **Details** | **Name**, **Description**, **Enabled** and the entry count. |
| **Placeholders** | The book's own [placeholders](World-Editor-Placeholders), across the full panel. **Advanced mode only.** |

In Simple mode the panel shows the Details fields with no tabs. The tab you pick stays open when you select another book.

## In the library

A dictionary in your library is always one book, so its editor has no row for the book. It has three tabs.

| Tab | What it holds |
|---|---|
| **Overview** | Everything about the book: **Tags** and **Cover Image**, beside **Name**, **Description** and **Enabled**. |
| **Dictionary** | The entries only. The **+** button at the top of the list adds one. |
| **Placeholders** | The book's own [placeholders](World-Editor-Placeholders), across the full width. |

The editor opens on **Dictionary** with the first entry selected. An empty book shows a hint beside the **+** button. Rename the book on **Overview**. The rename changes no world.

## Getting started

Start with one book and a few entries with plain keywords. Use the **Matching** tab only when an entry activates at the wrong time, or doesn't activate at the right time.
