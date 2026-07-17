# 🛠️ World Editor

A guide to each tab in the World Editor — what it does, why it exists, and the settings that aren't obvious from the screen.

> 💡 Every tab has a **?** button beside its search box with a short version of this page. This is the long version.

Sections land here as each tab's help is written, so a tab missing below simply isn't documented yet.

---

## Stats

The numbers that describe your player — health, coin, reputation, whatever your world needs. Each stat holds a value between a **Min** and a **Max**, and the AI sees them on every turn.

### Why it exists

Prose alone drifts. A stat is a fact the AI has to write around: it can't narrate you sprinting across a rooftop while your Stamina reads 4/100 without the number contradicting it.

The narrator is explicitly told to let stats shape *how an action turns out* — a low stat as effort and cost, a high one as ease — and **not** to tabulate them or report their changes. A separate step handles the actual numbers. So stats steer the story without it reading like a character sheet.

### What the AI sees

Each stat's **Name** is always sent. The Stats chip in your prompt decides what accompanies it:

| Piece | Adds |
|---|---|
| **Values** | The current value and its ceiling — `62/100` |
| **Status** | The matching Stat Descriptor — a word for the current level |
| **Meaning** | The stat's **Description** — what it represents |

With no piece selected, the line is just the stat's name.

> ⚠️ Every stat is sent on **every turn**. Stats are one of the steadiest drains on your context budget — three meaningful stats beat a dozen decorative ones.

### The fields

| Field | What it does |
|---|---|
| **Name** | Also how the AI refers to the stat, and how stat changes are matched back to it. |
| **Type** | Number. (List exists in the data format but isn't currently offered.) |
| **Description** | What the stat represents. Sent to the AI when the chip's **Meaning** piece is on. |
| **Min** / **Max** | The range. Values are always clamped to it. |
| **Initial Value** | Where the stat starts. Ignored when the stat has code. |
| **Regen** | Added to the value once per turn, then clamped. Positive heals over time; negative bleeds. |
| **Body Sliders** | Bind body morph sliders to this stat — its value, from Min to Max, drives each slider. Each slider belongs to only one stat. |

### Stat Descriptors

Descriptors turn a number into a word — `Winded`, `Exhausted` — which is what the AI receives when the chip's **Status** piece is on.

Each has a **Threshold %** and a **Description**. Two things trip authors up:

> ⚠️ **Threshold % is a percentage of the way from Min to Max — not a raw value.** With Min 0 / Max 200, a threshold of `50` means the value 100.
>
> ⚠️ **The first descriptor at or below the threshold wins, in list order.** List them low to high. If `100 → Fine` sits first, it matches everything and nothing below it is ever reached.

### Prevent AI Changes

Four checkboxes stop the AI moving a stat in one direction, while your world's own rules still can:

| Checkbox | Blocks |
|---|---|
| **Don't increase** | AI raising the value |
| **Don't decrease** | AI lowering the value |
| **Don't increase max** | AI raising the ceiling |
| **Don't decrease Max** | AI lowering the ceiling |

### Dynamic Value Calculation

A stat can compute itself from the others. Write JavaScript that **returns a number**, and it recalculates each turn instead of using Initial Value. **Test Code** runs it immediately and shows the result or the error.

```js
const health = stats.find(s => s.name === 'Health')?.value || 0;
const strength = stats.find(s => s.name === 'Strength')?.value || 0;
return (health + strength) / 2;
```

Your code runs in an isolated sandbox with a time limit. It sees a read-only copy of every stat — `id`, `name`, `type`, `description`, `min`, `max`, `value`, `regen` — and nothing else: no other stat's code, no descriptors, no page, no network.

**A calculated stat ignores the AI.** Its value is recomputed every turn, so anything the AI writes is overwritten. The AI still *reads* the value and description normally.

> 📘 Full reference: [Stat Code Guide](StatCodeGuide).

### Getting started

Start with two or three stats the story would genuinely turn on, each with a Min, Max and a couple of descriptors. Add Regen, locks and code only when a stat needs behavior the AI shouldn't be inventing.

---

## Entities

The people, creatures and things that populate your world — a ferryman, an eel-smoker, a barred door. An entity belongs to one or more **Locations**, and the AI is handed the ones that could turn up where the player is.

### Why it exists

Left to itself, the narrator invents a stranger, names them, and forgets both by the next turn. An entity is a fixed, reusable character the story can return to — one the AI is reminded of every time the player is somewhere it lives.

It's framed as a *cast list, not a roll-call*. The prompt heading is "Characters and things that **may** appear in this location", so eight entities at a location doesn't force eight into the scene — the AI casts who the moment needs.

### What reaches the AI

Assignment to a location is the entire gate: an entity in no location never reaches the AI at all.

| Field | Sent? |
|---|---|
| **Name** | Always |
| **AI-Facing Description** | Yes — the main thing the AI knows |
| **AI-Facing Summary** | Only in prompt slots that ask for the short form |
| **Type** | Yes, as a plain field |
| **Player-Facing Description** | **Never** |
| Image, Image Tags, 3D model, group, order | Never |

> 💡 **Player-Facing Description is a genuine secret.** It's shown to the player in-game and withheld from the AI, which makes it the right home for anything the narrator shouldn't be able to spoil.

### Descriptions and summaries

Three description fields, with distinct jobs:

- **Player-Facing Description** — what the player reads. Never sent to the AI.
- **AI-Facing Description** — the full text the AI works from.
- **AI-Facing Summary** — a one-line version for slots where the full description is too long. **Blank is fine** — it falls back to the full description. The default prompt uses summaries for entities in *reachable* locations, and full descriptions for the player's current location.

The **✨ toolbar** beside AI-Facing Summary can draft it from your AI-Facing Description.

### Locations

The link lives on the **location**, not the entity — the entity's Locations picker writes into each location's entity list. Same relationship from either end; assign it wherever you like.

The default prompt feeds entities from three places, as separate blocks: the player's **current location**, its **sub-locations**, and **reachable** locations.

> ⚠️ Every entity at the player's location is sent **every turn**. A crowded location is a permanent context bill — two or three that the scene turns on beat a populated village.

### Groups

Folders for your own sanity. Nesting and order are editor-only and **never reach the AI** — entities feed the AI exactly as if ungrouped, so grouping can never change the story.

### Images and models

The image and 3D model are for the player's screen. **Image Tags** are booru tags used only for AI image generation — the ✨ toolbar can draft them from the description, and uploading an image with an embedded prompt offers to use it. None of this reaches the narrator.

### Getting started

Write the AI-Facing Description first — it's the one that does the work. Add a Summary only if the entity turns up in reachable locations, and use the Player-Facing Description when the player and the AI should know different things.

---

## Dictionary

Your world's lorebook. Each **book** holds **entries**; an entry injects its content into the AI's prompt whenever one of its keywords appears in the text being scanned.

### Why it exists

The AI can't hold your whole world in mind at once — everything it knows on a given turn has to fit in a limited context window. Writing every detail into your world description spends that budget on every turn, whether it's relevant or not.

The Dictionary is the alternative: lore sits on standby and costs nothing until something brings it up. Mention the Gloamwater, and the AI suddenly knows what it is.

### What gets scanned

A **turn** is one action from you and the AI's reply. On each turn, Formamorph scans:

| Scanned | Always? |
|---|---|
| **Current scene** — your location, the characters present, and the action you just took | Always |
| **Earlier turns** — your actions and the AI's replies | Up to the entry's **Scan depth** |

Your world description is deliberately **excluded**. It's present every turn, so terms inside it would fire their entries constantly and defeat the point.

### The entry editor

Select an entry to open it. **Trigger Keywords (Key)** and **Value (injected on keyword match)** are the whole feature — everything else is there for a specific problem, and is safe to ignore until you hit one.

**Options**

| Checkbox | What it does |
|---|---|
| **Always inject** | Skip the scan; send this entry every turn. Costs context every turn, so use sparingly. |
| **Regex** | Treat keywords as regular expressions instead of plain text. |
| **Whole words** | Match on word boundaries, so *art* stops firing inside *cart*. |
| **Case-sensitive** | Off by default. |
| **Recursive** | Lets the entry be fired by the content of entries that already activated, not just by the scene. |

**Scan depth (messages)** — how many earlier messages to search. Leave it blank (*all history*) to search everything; `0` searches only the current scene.

**Secondary Keywords** — an extra condition on top of the trigger. *bridge* fires only if *toll* also appears in the scanned text.

| Checkbox | What it does |
|---|---|
| **Require all** | Every secondary keyword must appear, not just one of them. |
| **Exclude (activate when absent)** | Inverts the test — the entry fires only when the secondary keywords are **missing**. |

### Background and Foreground

Each book splits its entries into two collapsible groups, **BACKGROUND** and **FOREGROUND**. They're two separate lore blocks in the system prompt, and an entry's group decides which one it joins. New entries land in Foreground.

**To move an entry between them, drag it from one group into the other.** There's no dropdown — the groups are drop zones.

By default Background sits earlier in the prompt than Foreground, but **you control placement**: both blocks are filled by prompt chips you can move in the prompt editor. If your prompt has no Background chip, those entries fall into Foreground instead.

### Books

Books group related entries. Their order sets the order entries are injected, and disabling a book mutes everything inside it at once.

A book's **enabled** state is a *default*, not a lock. Before starting, players may see a step where they can toggle and reorder your books — alongside any dictionaries from their own library. That step only appears when there's a real choice to make: more than one book in the world, or at least one dictionary saved in the player's library.

### Getting started

Start with one book and a handful of plain keyword entries. Everything above exists for a specific problem — reach for it only when an entry fires when it shouldn't, or fails to fire when it should.
