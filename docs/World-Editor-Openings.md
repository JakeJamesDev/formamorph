# 🎬 World Editor: Openings
<!-- keywords: first page, prewritten first turn, how story begins, starter prompt, prefilled input box, set the tone, write beginning myself, match my style -->
<!-- route: worldEditor.openings -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

**Advanced mode only.** An opening is one way a playthrough can start. The world, each location and each entity can own openings. Write them on the **Openings** tab, after **Overview**. When a game starts, after **Start Game** (or **Continue to Avatar** and the Avatar step), the game draws one opening from the pool.

Each opening has two buttons, **Player Action** and **Narration**. This choice is its Opens As setting, and it decides where the text goes:

| Opens As | Called | Where the text goes | Who writes page one |
|---|---|---|---|
| **Player Action** | Opening Action | The player's input box. The player can edit it, then sends it. | The AI, from the sent action |
| **Narration** | Opening Narration | Page one itself, shown at once exactly as written. No narration request goes out. | You |

> 💡 **Use Opening Narration to set the voice.** The AI copies the style and length of page one for the rest of the story. A hand-written page one shows it what you want.

After an Opening Narration, the input box is empty. A written page one works like any other page. Choices, stat changes, the clock, read-aloud and the scene image all run on it.

## How to Add an Others Opening
<!-- keywords: first message, greeting, intro, start, starting scene, scene, opener, prologue, kickoff, beginning, initial prompt, hook, first turn -->
<!-- route: worldEditor.openings -->

An Others opening is the normal kind. Every opening starts as one.

1. Select **Advanced** at the top of the editor.
2. Open the **Openings** tab.
3. In the list, select **This World**, or the location or entity the opening belongs to.
4. Select **Add Opening** at the top of the right pane.
5. Write the opening's text.
6. Choose **Player Action** or **Narration**.
7. Optional: set its weight in the number box.

You can also use the **Openings** tab on a location's or an entity's own panel.

## The Openings tab
<!-- keywords: openings list, owners with openings, nested list, opening count, find an opening, one owner at a time -->

The **Openings** tab lists This World and every location and entity with openings on the left. The right pane shows the openings of the row you select.

| In the list | What it shows |
|---|---|
| **This World** | Always first, even with no openings yet |
| Locations | Each location with openings, nested as on the **Locations** tab |
| Entities | Each entity with openings, in its folders as on the **Entities** tab |
| Dimmed rows | A parent location or folder with no openings of its own. You can't select it. |

Each row shows how many openings it has. The **No Starting Location** icon marks a row whose openings never come up: see [Starting Location filter](#starting-location-filter).

- To give a location or entity its first opening, select **+**, then **Location** or **Entity**, and pick it. It's listed and selected with one blank opening. A location with locations inside it opens a list of them. To add to the location itself, pick **Add to <name>** at the top of that list.
- The owner's name at the top of the right pane opens its own **Openings** tab.
- After you delete an owner's last opening, its row stays until you select another row.
- Search finds an owner by its name or by the text of its openings. The right pane then shows only the matching openings.
- With more than one starting location, the **Starting Location** filter shows above the list. A pick keeps only what can come up at that start.

## How to Add a Self Opening
<!-- keywords: first message, greeting, intro, persona start, play as, player character start, protagonist beginning, main character opener, pov beginning, hero backstory opener, when i am them, own storyline kickoff -->
<!-- route: worldEditorEntity.openings -->

A Self opening starts the game for a player who plays as the entity.

1. Select **Advanced** at the top of the editor.
2. Select the entity. On its **Profile** tab, set **Persona** to **Playable**, **Persona-Only** or **Custom Persona**.
3. Open its **Openings** tab.
4. Select the **+** button (**Add Opening**), then write the text.
5. Select **Self** on the opening.

See [Self Openings](#self-openings) for when a Self opening draws.

## Weights and chances
<!-- keywords: odds, probability, frequency, rarity, randomize beginning, percentage, keep as draft, more often -->

| Setting | What it does |
|---|---|
| Weight (the number box) | How often the opening comes up, compared with the others. A missing weight counts as 1. The box takes whole numbers from 0: a decimal rounds, and a negative or blank value becomes 0. |
| Chance (the percentage beside it) | The share of draws this opening gets, calculated from all the weights. You don't set it. |
| Weight 0 | Keeps the opening in the list and never draws it. Use it to keep a draft. |

Drag a row by its handle to change its place in the list. Order doesn't change the chances.

## Collapse the Cards
<!-- keywords: fold, minimize, shrink rows, hide long text, expand all, too much scrolling, compact list -->

Each opening is a card. A collapsed card is one line. It holds the handle, "Opening N", the first line of the text, the switches, the weight, the chance and **Remove opening**.

Every control works while the card is collapsed. You can drag cards and tune weights without scrolling past the text.

| Rule | Effect |
|---|---|
| **Opens collapsed** | A list of three or more openings opens collapsed. A shorter list opens expanded. |
| **New opening** | It opens expanded, so you can write it at once. |
| **Collapse all openings / Expand all openings** | The button above each list of two or more cards sets every card in that list at once. |
| **Not saved** | The open state never goes into your world file. |

## When openings draw
<!-- keywords: turn off all, master toggle, checkbox greyed out, wont check, disable without deleting, checked itself, not being used, no switch -->

A world uses its openings whenever one has text. To stop an opening from drawing, set its weight to `0` or delete it. An empty opening doesn't count. Neither does an Others opening on the Custom Persona or a Persona-Only entity, because it never draws.

A world with no opening that can draw plays the default opening.

> 💡 **A world saved with openings switched off now draws them.** Older versions had a switch. This version ignores it and removes it from the file when it loads the world.

## The default opening
<!-- keywords: fallback, none written, generic beginning, built-in start, ai writes first scene, empty pool, what if none -->

The default opening is an Opening Action with a general instruction to write the opening scene. The game uses it at a start where nothing else can come up:

- The world, its locations and its entities have no opening that can draw.
- The pool at that start is empty.

The **Openings** panel shows its text under **This World**. It shows the text only where it can draw:

| Panel view | The default opening shows |
|---|---|
| A **Starting Location** with an empty pool | Yes |
| **All Locations** | Yes, with the names of the starts that have an empty pool |
| No start has an empty pool | No |

## Every opening in one place
<!-- keywords: see all at once, grouped by owner, filter by start, dash instead of percent, badge, never comes up, master list, adds up to 100 -->

The **Openings** panel shows every opening in the world, grouped by owner:

| Group | Holds |
|---|---|
| **This World** | The world's own openings |
| One group per location with openings | The openings on that location's **Openings** tab. The location's name opens that tab. |
| One group per entity with openings | The openings on that entity's **Openings** tab. The entity's name opens that tab. |

Groups run in this order: World, Locations, Entities. Each location and entity group has a button that reads **Add Opening to** and the owner's name. Add a world opening with the **+** button (**Add Opening**) at the top of the panel. Search reaches every group.

An edit in the panel changes the owner's opening.

### Starting Location filter

With more than one starting location, the **Starting Location** filter shows above the list. It opens on **All Locations**. The pick only changes what the panel shows, and it isn't saved with the world.

| Pick | The panel shows |
|---|---|
| **All Locations** | Every opening in the world. Chances hide, except on Self openings. |
| **A location** | The openings that can come up at that start, with chances |

A chance is the share of the whole draw at one starting location. World, location and entity rows add up to 100% together.

| The chance shows | Means |
|---|---|
| **A percentage** | The row can come up at that location |
| **0%** | The row has weight 0, or no text |

A world with one starting location has no filter. The panel shows chances as at that start. A row that can't come up there shows a dash.

An entity at no starting location shows a **No Starting Location** badge. A location that isn't a starting location shows it too. Their openings never come up. The **Custom Persona** entity and a **Persona-Only** entity never show this badge. Their Others openings show a **Never Draws** badge: see [Self Openings](#self-openings).

With no location marked **Starting Location**, every location counts as one. In a world with no locations, only the world's own openings draw. Other entity groups with Others openings show the **No Starting Location** badge, unless those openings show **Never Draws**.

## Location Openings
<!-- keywords: start per place, room specific intro, area greeting, different per spawn, place based beginning, parent not inherited -->
<!-- route: worldEditorLocation.openings -->

A location has its own **Openings** tab, its last tab. The rows work the same as the world's openings.

| Rule | Effect |
|---|---|
| **Exact start** | The openings join the draw only when the game starts at this location. A child location never draws its parent's openings. |
| **With Self openings** | Location openings stay out of the draw while a persona with Self openings is played. |

## Regenerate on page one
<!-- keywords: reroll, different start, another beginning, retry first page, cycle greetings, same page again -->

**Regenerate Narration** on page one draws again. The game picks an opening it hasn't shown yet in this session. When every opening has been shown, the draw starts over.

- An Opening Narration replaces page one. When the draw comes back with the same page, it stays.
- An Opening Action clears page one and fills the input box again, with your own edit when the same opening comes back. Send it to start the game.

To check the draw before you play, use the **Opening** tab of the [Test Bench](Test-Bench#how-to-preview-the-opening).

## Chips, search and older worlds
<!-- keywords: variables in intro, my name in intro, legacy world, ai asks what next, ai offers options, pre-filled action, random details per run -->

- **[Placeholder](World-Editor-Placeholders) chips work in openings.** A Wildcard rolls per playthrough, so the same opening can read differently each time. An **Entity Name** chip in an entity's opening names that entity.
- **The Persona Name chip works in openings.** Type `{` and pick **Persona Name**. Page one then says the [persona](Persona-Authoring#the-persona-name-chip)'s name, or "you" when the player has none. A page one that is already written keeps its text when the player changes persona.
- **Search and replace reaches every opening**, on the world, each location and each entity.
- **A world saved with one pre-filled opening** loads with it as an Opening Action. The old on and off setting is dropped, so the opening draws.
- **A world saved before openings existed** has none, so the world plays the default opening. Nothing is stored and nothing is lost.

> ⚠️ **An Opening Action is sent as written.** Nothing is added to it. The default opening tells the AI not to ask the player what to do next. Keep a line like that in your own Opening Actions, or the AI may open by offering options.

## Entity Openings
<!-- keywords: npc greeting, character speaks first, npc first message, greeting never shows, card greetings, npc intro rules, added from library -->
<!-- route: worldEditorEntity.openings -->

**Advanced mode only** in the World Editor. The library entity editor always shows it. The **Openings** tab is the last tab. It gives an entity its own openings, so it can start the scene in its own voice. The rows work the same as the world's openings above.

| Rule | Effect |
|---|---|
| **Starting location** | The entity's Others openings join the draw only when it is at the player's starting location. Those of the **Custom Persona** entity and a **Persona-Only** entity never join. |
| **Library entity picked at Enter World** | When the player adds a library entity that has openings, the game draws from that entity's openings only. They never draw when the world, its locations and its entities have no openings. That world plays the default opening. |
| **Entity card** | The openings, their **Others** or **Self** switch and their weights travel with the entity in its [card file](Library#how-to-export-an-entity-or-a-dictionary) and in a published listing. |
| **Played entity** | When the player plays this entity as their [persona](Persona-Authoring#how-to-make-an-entity-playable), its **Others** openings leave the draw for that game. Its **Self** openings take over. See below. |

## Self Openings
<!-- keywords: which start wins, priority order, protagonist intro, start per hero, playing as them, replaces normal pool, switch missing -->

An opening has a second switch, **Others** or **Self**.

| Switch | Meaning |
|---|---|
| **Others** | The entity greets the player. This is the default, and every older opening reads as Others. |
| **Self** | A start written for playing as this entity. It draws only while the player plays it. |

The switch shows on world entities set to **Playable**, **Persona-Only** or **Custom Persona**, and on library entities set to **Playable**. It never shows on the world's or a location's openings. A flip keeps the text, the Opens As choice and the weight.

### Who draws a Self opening

The game looks for Self openings in this order. The first source that has one wins, and the draw uses only those openings.

| Order | Source | When |
|---|---|---|
| 1 | The played persona's Self openings | The player plays a world entity or a library persona that has Self openings |
| 2 | The **Custom Persona** entity's Self openings | The player picks **None**, or a library persona with no Self openings |
| 3 | The normal pool | No Self openings found. Library Additions, then the world, locations and present entities. |

- **Self openings replace the whole pool.** A player never gets another persona's start.
- **They draw by weight among themselves.** The chance on a Self row is its share of that persona's Self openings. It shows under every filter value.
- **Regenerate draws again from the same Self openings.**
- **Self beats Library Additions.** Who the player plays decides the start before who they brought along.
- **A library persona's Self openings work in any world.** They come with the persona.
- **Self openings draw whenever the played entity has one.**
- **A world persona with no Self openings starts on the normal pool.** Its Others openings still stay out.
- **A library persona with no Self openings uses the Custom Persona's Self openings.** With none there, it starts on the normal pool.
- **A Persona-Only entity's Self openings draw when the player picks it.**
- **The Others openings of the Custom Persona entity and a Persona-Only entity never draw.** Each one shows a **Never Draws** badge and a dash for its chance. Select **Self** on one to draw it. A filter on one location hides these rows.
- **Setting it back to Cast keeps the text.** An entity set back to **Cast** keeps its Self openings in the file. The editor hides them until you set it to a persona choice again.

In the panel, Self openings stay in their owner's group with a **Self** badge.

> 💡 **Write a start for each persona.** Set each persona to **Playable**, add an opening, and select **Self** on it. A player who picks that persona then starts on it.
