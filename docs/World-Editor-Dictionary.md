# 📖 World Editor: Dictionary

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Your world's lorebook. Each **book** holds **entries**; an entry injects its content into the AI's prompt whenever one of its keywords appears in the text being scanned.

## Why it exists

The AI can't hold your whole world in mind at once — everything it knows on a given turn has to fit in a limited context window. Writing every detail into your world description spends that budget on every turn, whether it's relevant or not.

The Dictionary is the alternative: lore sits on standby and costs nothing until something brings it up. Mention the Gloamwater, and the AI suddenly knows what it is.

## What gets scanned

The rule: **if the AI is told it, it can fire a trigger.** A **turn** is one action from you and the AI's reply. On each turn, Formamorph scans:

| Scanned | Always? |
|---|---|
| **The scene as the AI receives it** — your location and the characters present, plus any nearby / sub-location detail your prompt sends | Always |
| **Your notes** and the **action** you just took | Always |
| **Earlier turns** — your actions and the AI's replies | Up to the entry's **Scan Depth** |

> 💡 Keywords match **the exact wording the AI is given**. Where a block is sent as a *summary*, the summary is what's matched — so a keyword that appears only in an entity's full description won't fire if the AI was sent the short version. Check which form your prompt sends in **Settings → Output → Turn Extras**.

Text that appears on **every** turn is deliberately **excluded** — your world description, stats, traits, and formatting guidance. Terms inside them would fire their entries constantly and defeat the point.

Lore doesn't trigger other lore unless you ask it to: that's what **Recursive** is for.

## The entry editor

Select an entry to open it. **Trigger Keywords** and **Value** are the whole feature — everything else is there for a specific problem, and is safe to ignore until you hit one.

**Options**

| Checkbox | What it does |
|---|---|
| **Always Inject** | Skip the scan; send this entry every turn. Costs context every turn, so use sparingly. |
| **Regex** | Treat keywords as regular expressions instead of plain text. |
| **Whole Words** | Match on word boundaries, so *art* stops firing inside *cart*. |
| **Case-Sensitive** | Off by default. |
| **Recursive** | Lets the entry be fired by the content of entries that already activated, not just by the scene. |

**Scan Depth** — how many earlier messages to search. Leave it blank (*all history*) to search everything; `0` searches only the current scene.

**Secondary Keywords** — an extra condition on top of the trigger. *bridge* fires only if *toll* also appears in the scanned text.

| Checkbox | What it does |
|---|---|
| **Require All** | Every secondary keyword must appear, not just one of them. |
| **Exclude** | Inverts the test — the entry fires only when the secondary keywords are **missing**. |

## Background and Foreground

Each book splits its entries into two collapsible groups, **BACKGROUND** and **FOREGROUND**. They're two separate lore blocks in the system prompt, and an entry's group decides which one it joins. New entries land in Foreground.

**To move an entry between them, drag it from one group into the other.** There's no dropdown — the groups are drop zones.

By default Background sits earlier in the prompt than Foreground, but **you control placement**: both blocks are filled by prompt chips you can move in the prompt editor. If your prompt has no Background chip, those entries fall into Foreground instead.

## Books

Books group related entries. Their order sets the order entries are injected, and disabling a book mutes everything inside it at once.

A book's **enabled** state is a *default*, not a lock. Before starting, players may see a step where they can toggle and reorder your books — alongside any dictionaries from their own library. That step only appears when there's a real choice to make: more than one book in the world, or at least one dictionary saved in the player's library.

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

Start with one book and a handful of plain keyword entries. Everything above exists for a specific problem — reach for it only when an entry fires when it shouldn't, or fails to fire when it should.
