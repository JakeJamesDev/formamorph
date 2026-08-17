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
| **Values** | The current value and its ceiling — `62/100`, or `62%` for a percentage stat |
| **Status** | The matching Stat Descriptor — a word for the current level |
| **Meaning** | The stat's **Description** — what it represents |

With no piece selected, the line is just the stat's name.

> ⚠️ Every stat is sent on **every turn**. Stats are one of the steadiest drains on your context budget — three meaningful stats beat a dozen decorative ones.

### The fields

| Field | What it does |
|---|---|
| **Name** | Also how the AI refers to the stat, and how stat changes are matched back to it. |
| **Type** | **Number** (a range you set) or **Percentage** (pinned 0–100, shown everywhere as `N%`). Everything below works the same for both. (List exists in the data format but isn't currently offered.) |
| **Description** | What the stat represents. Sent to the AI when the chip's **Meaning** piece is on. |
| **Min** / **Max** | The range. Values are always clamped to it. A percentage stat locks these at 0 / 100 and hides Max — you set only its **Initial Value (%)**. |
| **Initial Value** | Where the stat starts. Ignored when the stat has code. |
| **Regen** | Added to the value once per turn, then clamped. Positive heals over time; negative bleeds. |
| **Body Sliders** | Bind body morph sliders to this stat — its value, from Min to Max, drives each slider. Each slider belongs to only one stat. |

### Stat Descriptors

Descriptors turn a number into a word — `Winded`, `Exhausted` — which is what the AI receives when the chip's **Status** piece is on.

Each has a **Threshold %** and a **Description**. Two things trip authors up:

> ⚠️ **Threshold % is a percentage of the way from Min to Max — not a raw value.** With Min 0 / Max 200, a threshold of `50` means the value 100.
>
> ⚠️ **A threshold is the *top* of its band, and the lowest band the value fits in wins.** Descriptors are read low to high whatever order you list them in, so `30 → Barren` covers 0–30% and a `60` above it covers everything up to 60%. Give your highest descriptor a threshold of `100`, or a value above it gets no descriptor at all.

### Prevent AI Changes

Four checkboxes stop the AI moving a stat in one direction, while your world's own rules still can:

| Checkbox | Blocks |
|---|---|
| **Don't increase** | AI raising the value |
| **Don't decrease** | AI lowering the value |
| **Don't increase max** | AI raising the ceiling |
| **Don't decrease Max** | AI lowering the ceiling |

Percentage stats show only the first two — their ceiling is pinned at 100, so the AI can never move it.

### Dynamic Value Calculation

A stat can compute itself from the others. Write JavaScript that **returns a number**, and it recalculates each turn instead of using Initial Value. **Test Code** runs it immediately and shows the result or the error.

Your code reads a copy of every stat and the story clock from an isolated sandbox — no page, no network, no other stat's code. The editor suggests what's in reach as you type and underlines what isn't.

**A calculated stat ignores the AI.** Its value is recomputed every turn, so anything the AI writes is overwritten. The AI still *reads* the value and description normally.

> 📘 Full reference: [Stat Code Guide](StatCodeGuide).

### Getting started

Start with two or three stats the story would genuinely turn on, each with a Min, Max and a couple of descriptors. Add Regen, locks and code only when a stat needs behavior the AI shouldn't be inventing.

---

## Entities

The people, creatures and things that populate your world — a ferryman, an eel-smoker, a barred door. An entity belongs to one or more **Locations**, and the AI is handed the ones that could turn up where the player is.

### Why it exists

Left to itself, the narrator invents a stranger, names them, and forgets both by the next turn. An entity is a fixed, reusable character the story can return to — one the AI is reminded of every time the player is somewhere it lives.

The default prompt introduces them under "Characters and things that **may** appear in this location". That hedge is a hint to the AI, not a rule the app enforces — nothing stops the narrator reaching for anyone on the list, and the wording is yours to change in the prompt editor.

### What reaches the AI

Assignment to a location is the entire gate: an entity in no location never reaches the AI at all.

| Field | Sent? |
|---|---|
| **Name** | Always |
| **Aliases** | Yes — as "also known as" |
| **AI-Facing Description** | Yes — the main thing the AI knows |
| **AI-Facing Summary** | Only in prompt slots that ask for the short form |
| **Type** | Yes, as a plain field |
| **Player-Facing Description** | **Never** |
| Image, Image Tags, 3D model, group, order | Never |

> 💡 **The two descriptions are disjoint, and that's the point.** The player only ever sees the Player-Facing one; the AI only ever sees the AI-Facing one. So the **AI-Facing Description** is where a secret lives — the narrator can act on it while the player stays in the dark. The default prompt even asks the narrator to hold a name back until the player would plausibly have learned it, though that's a request to the AI rather than something the app enforces.

### Descriptions and summaries

Three description fields, with distinct jobs:

- **Player-Facing Description** — what the player reads on the entity's card. Never sent to the AI, so it costs no context; whatever you write here, the player simply knows.
- **AI-Facing Description** — the full text the AI works from, and the player never sees it. This is the one that does the work, and the one a secret goes in.
- **AI-Facing Summary** — a one-line version for slots where the full description is too long. **Blank is fine** — it falls back to the full description. The default prompt uses summaries for entities in *reachable* locations, and full descriptions for the player's current location.

The **✨ toolbar** beside AI-Facing Summary can draft it from your AI-Facing Description.

### Aliases

Other names the entity goes by — a title, a nickname, an epithet. They do two jobs: the AI is told them as *"also known as"*, and the story parser counts the entity as **present** when the narration uses one, not just when it uses the real name.

| | |
|---|---|
| **Case-sensitive** | `Matron` matches "the Matron" and misses "the matron". Add every casing narration is likely to write. |
| **Plural-aware** | `wolf` also matches "wolves", the same as names. |
| **Whole words** | `Em` won't fire inside "System". |

> ⚠️ **Never start an alias with "the".** Narration puts a title at the start of a sentence constantly, and "The alpha…" won't match an alias written `the alpha`. Drop the article — `alpha` matches both positions.

Two more worth knowing:

- **Skip generic job titles.** `knight`, `alchemist`, `apprentice` will fire on any passing character of that trade and pull the wrong entity into the scene.
- **Don't alias a role the story uses for someone off-page.** Quoted dialogue is excluded from presence detection, but plain narration isn't — so if the prose says *"she was sent by the Warchief"*, an alias of `Warchief` marks the Warchief present in a scene she isn't in.

### Locations

The link lives on the **entity**: one character's whereabouts is one field, however many places it turns up in. The location's own Entities picker is the same relationship seen from the other end — set it wherever you prefer.

> ⚠️ **Deleting a location removes it from everyone who was there, silently.** The entities themselves survive — but one that was only in that location is now in no location, which means it never reaches the AI again. Nothing warns you, and the entity still looks fine in its own tab.

The default prompt feeds entities from three places, as separate blocks: the player's **current location**, its **sub-locations**, and **reachable** locations.

> ⚠️ Every entity at the player's location is sent **every turn**. A crowded location is a permanent context bill — two or three that the scene turns on beat a populated village.

### Groups

Folders for your own sanity. Nesting and order are editor-only and **never reach the AI** — entities feed the AI exactly as if ungrouped, so grouping can never change the story.

### Images and models

The image and 3D model are for the player's screen. **Image Tags** are booru tags used only for AI image generation — the ✨ toolbar can draft them from the description, and uploading an image with an embedded prompt offers to use it. None of this reaches the narrator.

#### Upload or link

Every image field takes either an uploaded file or a web address pasted into the **Or paste an image URL** box. The difference is where the picture lives:

| | Uploaded | Linked |
|---|---|---|
| Stored in your world | Yes — full size counts toward the file | No — just the address |
| Works offline | Always | After you've seen it once, or via **Make Available Offline** |
| Survives the host going away | Always | No |

**Link when your world has a lot of pictures** — a published world stays small no matter how many it carries. **Upload when it matters that the picture can't disappear.**

A linked slot shows a 🔗 marker. Two of them are warnings worth reading:

- **Expiring link** — Discord *attachment* links stop working after a while, so the picture will vanish for anyone playing later. Discord's permanent addresses (avatars, emojis, server icons) are fine.
- **Display only** — that site won't let Formamorph download the picture. It shows normally online, but can't be saved for offline use or put into a character card. Uploading the file instead is the fix.

> 💡 **Make Available Offline** in a world's details window downloads all its linked pictures at once, so the world is ready before you lose your connection.

Exporting a world with linked pictures asks whether to keep the links (small file) or download them into it (works anywhere). Exporting a **character card** always downloads the portrait, because the card *is* the picture.

### Getting started

Write the AI-Facing Description first — it's the one that does the work, and it's safe to put things there the player shouldn't know yet. Add a Summary only if the entity turns up in reachable locations. Reach for the Player-Facing Description when you want the player to read something the AI has no use for.

---

## Locations

The places your story happens. The player is always in exactly one, and it decides what the AI is told about the scene — the description, who's present, and where the story might go next.

### Why it exists

Without a fixed place the narrator drifts: the tavern becomes a street becomes a forest, and nothing stays put. A location is an anchor the AI is handed again on every turn.

### Nesting is the AI's map, not the player's

This is the part that surprises people.

> 💡 **The player can travel anywhere, always.** The in-game location list offers **every** location in your world, unfiltered, no matter how you've arranged them. Nesting never gates a player's choice, and no arrangement can strand them.

What nesting decides is where **the story** can take the player. When the AI reads an action as movement, it only considers places connected to where they already are:

| From | The story can move them |
|---|---|
| A **top-level** location | Down into its own sub-locations |
| A **sub-location** | Down into its children, **up** to its parent, and **sideways** to its siblings |

…unless you've drawn a **Connection** between two places, which takes over that pair entirely — see [Connections](#connections) below.

By default the story *offers* the move — a small **Move to _X_?** prompt with **Go** and **Dismiss** — rather than making it for you.

Two consequences worth knowing:

- **A flat list of top-level locations** gives the AI nothing to connect, so it never proposes a move. Travel becomes entirely player-driven — a legitimate design, just a deliberate one.
- **A single-location world** never runs the router at all.

If the AI's answer doesn't match a connected place, it's discarded and nothing is offered — the story can never teleport the player somewhere unconnected.

### What reaches the AI

| Field | Sent? |
|---|---|
| **Name** | Always |
| **AI-Facing Description** | Yes — the main thing the AI knows |
| **AI-Facing Summary** | Only in prompt slots that ask for the short form |
| **Player-Facing Description** | **Never** |
| Background image, Image Tags, ambient sound, starting flag, nesting | Never |

The default prompt gives the **narrator** the current location in full, and its sub-locations and reachable places as summaries.

> ⚠️ **Only the narrator gets the full description.** The other steps — the choice writer, the continuity planner, the location router — are sent the **summary** of the current location too. So anything the AI must act on that lives *only* in the full description (a random-event list, a rule about the place) reaches the narrator and nobody else. Writing a summary is what switches those steps over: leave it blank and they fall back to the full text.

> 💡 **The two descriptions are disjoint.** The player only ever sees the Player-Facing one; the AI only ever sees the AI-Facing one — so the AI-Facing Description is where a secret lives.

The **✨ toolbar** beside AI-Facing Summary can draft it from your AI-Facing Description. Blank is fine — it falls back to the full description.

### Entities

The **Entities** picker lists who's at this location. Membership is stored on each entity, so editing here writes to their **Locations** — the same link, set from whichever end suits you.

### Connections

Nesting hands out travel for free, and it's always mutual. **Connections** are the deliberate version: a link between *any* two locations, wherever they sit in the tree.

The **Connections** section on a location lists every link it's part of, seen from where you're standing:

| Direction | Means |
|---|---|
| **Two-Way** | The story can move the player either way. This is what a new Connection starts as. |
| **Outgoing** | The story can leave here for the other place — and can never bring them back. |
| **Incoming** | The story can arrive here from the other place, but not go the other way. |

Pick a place from the **Connect to…** dropdown and press **Add Connection**. The **Travel Hint** box is optional and goes to the AI — *through the shimmering portal*, *down the rope ladder* — so the story knows *how* the trip is made.

> ⚠️ **A Connection replaces whatever free travel those two places had.** That's what makes a one-way link genuinely one-way, even between two sub-locations of the same place. The story is never offered the trip back — it isn't told not to take it, it simply never sees it.

One Connection is one link, so it appears on **both** locations' panels — flipping it from either end moves the same record, and deleting it from either end deletes it once. Deleting a location deletes its Connections with it.

> 💡 The player's own location list is still unfiltered — Connections steer the *story*, exactly like nesting does.

### Starting location

The checkbox marks a place a new game can begin. It does more than it looks:

| Ticked | Result |
|---|---|
| **None** | The game starts at a **random location — any of them**. Rarely what you want. |
| **One** | Every game starts there. |
| **Several** | The player chooses between them before starting. |

### Getting started

Write the AI-Facing Description first — it's the one doing the work. Reach for nesting when you want the story to move the player on its own, add Connections where you want a link nesting can't express, and tick at least one starting location so new games don't begin somewhere arbitrary.

---

## Traits

The choices that make one playthrough different from the next — *Scarred*, *Silver-Tongued*, *Afraid of Water*. The player picks their traits before the story starts, and the ones they take are described to the AI on every turn.

### Why it exists

A trait is a durable fact about the character. Stats move constantly and the story moves with them; a trait stays put, so the narrator is handed the same truth on turn one and turn ninety. A stat says *how much*; a trait says *who you are*.

> 💡 **Only chosen traits reach the AI.** A trait the player didn't take is sent nowhere and does nothing. Everything below applies to the ones they picked.

### What the AI sees

| Field | Sent? |
|---|---|
| **Name** | Always (it's the fallback when the AI description is blank) |
| **AI-Facing Description** | Yes — what the AI is told the trait means |
| **Player-Facing Description** | **Never** |
| **Stat Changes** | **Never** |

A blank **AI-Facing Description** falls back to just the trait's name — often enough for something self-explanatory like *Left-Handed*.

> 💡 **Stat Changes are invisible to the AI.** It's told the player is *Sickly*; it's never told that cost them 20 Vigor. The number does its work through the stat itself, so write the description as a fact the narrator can act on — *"Flinches at open water"*, not *"-20 swimming"*.

### Enabled by Default

Pre-checks the trait on the selection screen. The player can still untick it — it's a default, not a requirement.

### Stat Changes

Each row adjusts one stat when the trait is taken: a stat, a number, and what to change.

> ⚠️ **Every type is an adjustment, not a setting.** `+20` on a stat that starts at 50 gives 70, not 20.

| Type | Effect |
|---|---|
| **Starting Value** | Shifts where the stat begins. |
| **Min** | Raises the floor, pulling the value up with it if it's below. Can be lowered only far enough to undo another trait's raise — **never below the floor the stat was authored with**. |
| **Max** | Moves the ceiling either way. Lowering it below the current value drags the value down too. |
| **Regen** | Adds to what the stat recovers each turn. Negative bleeds. |

Min and Max are deliberately asymmetric: a trait can take the ceiling anywhere, but can never push a stat below the range its author designed.

### Groups

Groups organize the list — and unlike organizational folders elsewhere, a trait group also **speaks to the AI**. Give a group an **AI-Facing Description** and it becomes a header above its chosen traits, letting you frame a whole set at once (*"Origin: where this life began"*). A group with no chosen traits inside it is skipped entirely.

#### Exclusive

Tick **Exclusive** when the group is a choice between options rather than a list to tick — a species, an origin, a starting class. It renders as radio buttons and holds the group to at most one trait: picking one drops the one you had. Clicking the trait you already chose clears it, so "none of these" stays reachable. In-game it works the same for switchable traits — turning one on retires its siblings.

> 💡 **Give an exclusive group a default.** Mark one trait *Enabled by Default* so there's always a valid answer; without one, "nothing selected" is a state the AI has to interpret. If you mark two, the first in the list wins.

### Getting started

Name the trait, write one line of AI-Facing Description that reads as character rather than mechanics, and add Stat Changes only when the trait should also move a number. Leave the description blank for anything the name already says.

---

## Dictionary

Your world's lorebook. Each **book** holds **entries**; an entry injects its content into the AI's prompt whenever one of its keywords appears in the text being scanned.

### Why it exists

The AI can't hold your whole world in mind at once — everything it knows on a given turn has to fit in a limited context window. Writing every detail into your world description spends that budget on every turn, whether it's relevant or not.

The Dictionary is the alternative: lore sits on standby and costs nothing until something brings it up. Mention the Gloamwater, and the AI suddenly knows what it is.

### What gets scanned

The rule: **if the AI is told it, it can fire a trigger.** A **turn** is one action from you and the AI's reply. On each turn, Formamorph scans:

| Scanned | Always? |
|---|---|
| **The scene as the AI receives it** — your location and the characters present, plus any nearby / sub-location detail your prompt sends | Always |
| **Your notes** and the **action** you just took | Always |
| **Earlier turns** — your actions and the AI's replies | Up to the entry's **Scan depth** |

> 💡 Keywords match **the exact wording the AI is given**. Where a block is sent as a *summary*, the summary is what's matched — so a keyword that appears only in an entity's full description won't fire if the AI was sent the short version. Check which form your prompt sends in **Settings → Output → Turn Extras**.

Text that appears on **every** turn is deliberately **excluded** — your world description, stats, traits, and formatting guidance. Terms inside them would fire their entries constantly and defeat the point.

Lore doesn't trigger other lore unless you ask it to: that's what **Recursive** is for.

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

---

## Placeholders

Reusable bits of world text you define once and drop into your writing as chips — an eye color, a street name, a deity. Each has a **Name** and a list of **Values**, and everywhere its chip appears, it resolves to one of those values when the story runs.

### Why it exists

So a world can vary without being rewritten. Author *"the {{Eye Color}} stranger"* once and it reads as a real detail every playthrough — the same detail on purpose, or a fresh one each time.

### Variable or Wildcard

The kind is inferred from how many values you give it — there's no separate switch.

| Values | Kind | Resolves to |
|---|---|---|
| **One** | **Variable** | Always that value. Edit it here once and every chip updates. |
| **Two or more** | **Wildcard** | A random one of the values. |
| **None** | — | Nothing (empty). Give it at least one value. |

### World vs. Unique

A **Wildcard** chip chooses how its roll is shared, per placement:

| Scope | Behavior |
|---|---|
| **World** | Every World chip of this placeholder shows the **same** rolled value everywhere — one town name, used consistently. |
| **Unique** | Each placement rolls on its own — ten Unique *Eye Color* chips give ten independent eyes. |

> ⚠️ **Independent doesn't mean different.** Each Unique placement draws on its own, so two of them can land on the same value — three chips from a ten-value list show a repeat about a third of the time. Where two chips *must* differ (two towns that can't share a name), give each its own placeholder with values the other doesn't have.

A **Variable** ignores this — it's the same single value no matter what.

### The roll is frozen for the playthrough

> 💡 A Wildcard rolls **once, when a game begins**, and the result is stored in that save. The stranger with gray eyes on turn one still has them on turn ninety, and reloading the save changes nothing. A new game rolls fresh.

### Where chips work

Placeholders resolve **both** in what the AI reads and in what the player sees, in any field with the chip picker:

- entity, location and dictionary descriptions
- the readme
- the system prompt addition

> ⚠️ **The World Description is the exception.** It's shown in the library *before* a playthrough exists, so there are no rolls to resolve yet — that field takes no chips at all.

### Getting started

Define the placeholder here, then place its chip from any field that offers them. Reach for a Wildcard when you want variety, a Variable when you want one editable fact in many places.
