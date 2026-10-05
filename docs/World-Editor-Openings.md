# 🎬 World Editor: Openings
<!-- keywords: first page, prewritten first turn, how story begins, starter prompt, prefilled input box, set the tone, write beginning myself, match my style -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

**Advanced mode only.** An opening is one way a playthrough can start. Open **Custom Prompts** → **Openings** to write them. The world, each location and each entity can own openings. When a player presses **Start game**, the game draws one opening from the pool.

Each opening has two buttons, **Player Action** and **Narration**. This choice is its Opens As setting, and it decides where the text lands:

| Opens As | Called | Where the text lands | Who writes page one |
|---|---|---|---|
| **Player Action** | Opening Action | The player's input box. The player can edit it, then sends it. | The AI, from the sent action |
| **Narration** | Opening Narration | Page one itself, shown at once exactly as written. No narration request goes out. | You |

> 💡 **Use Opening Narration to set the voice.** The AI copies the style and length of page one for the rest of the story. A hand-written page one shows it what you want.

After an Opening Narration, the input box is empty. A written page one works like any other page. Choices, stat changes, the clock, read-aloud and the scene image all run on it.

## How to Add an Others Opening
<!-- keywords: first message, greeting, intro, start, starting scene, scene, opener, prologue, kickoff, beginning, initial prompt, hook, first turn -->
<!-- route: worldEditor.overview#custom-prompts -->

An Others opening is the normal kind. Every opening starts as one.

1. Select **Advanced** at the top of the editor.
2. Open the **Overview** tab.
3. Under **Custom Prompts**, select **Openings**.
4. Select the **+** button (**Add Opening**) at the top of the panel. The new opening belongs to the world.
5. Write the opening's text.
6. Choose **Player Action** or **Narration**.
7. Optional: set its weight in the number box.

To add an opening to a location or an entity, select **Add Opening to** and its name under its group. You can also use the **Openings** tab on its own panel.

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
| Weight (the number box) | How often the opening comes up, compared with the others. A missing weight counts as 1. |
| Chance (the percentage beside it) | The share of draws this opening gets, calculated from all the weights. You don't set it. |
| Weight 0 | Keeps the opening in the list and never draws it. Use it to keep a draft. |

Drag a row by its handle to change its place in the list. Order doesn't change the chances.

## Collapse the Cards
<!-- keywords: fold, minimize, shrink rows, hide long text, expand all, too much scrolling, compact list -->

Each opening is a card. A card collapses to one line: the handle, "Opening N", the first line of its text, the switches, the weight, the chance and delete. Every control works while the card is collapsed, so you can drag and tune weights without scrolling past the text.

| Rule | Effect |
|---|---|
| **Opens collapsed** | A list of three or more openings opens collapsed. A shorter list opens expanded. |
| **New opening** | It opens expanded, so you can write it at once. |
| **Collapse all openings / Expand all openings** | The button above each list of two or more cards sets every card in that list at once. |
| **Not saved** | The open state never goes into your world file. |

## The list switch
<!-- keywords: turn off all, master toggle, checkbox greyed out, wont check, disable without deleting, checked itself, not being used -->

The checkbox beside **Openings** turns the whole list on or off. Off keeps every row and its text. Players then start on the default opening. Off covers every opening in the world, including locations, entities and an entity the player picks at Enter World.

**The box starts unchecked and is disabled until an opening with text exists.** Write one here, on a location or on an entity, and it checks itself. An empty opening doesn't count. A player who plays a library persona with Self openings also turns it on, unless you unchecked it. There is nothing to switch before that: a world with no openings plays the default opening either way.

> 💡 **The chances stay visible with the switch off.** They show the odds after you switch the list on. Tune the weights before you publish.

> ✅ **Adding an entity with openings checks the box.** Add an entity that brings an opening and the box checks itself, with a message naming the entity. Its openings would never draw otherwise.

## The default opening
<!-- keywords: fallback, none written, generic beginning, built-in start, ai writes first scene, empty pool, what if none -->

The game uses the default opening at a start where nothing else can come up. That happens when the switch is off, or when the pool at that start is empty. A world with no openings reads unchecked, because the box follows whether openings exist. This is an Opening Action with a general instruction to write the opening scene.

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

An edit in the panel changes the owner's opening. The switch covers every group.

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

An entity at no starting location shows a **No Starting Location** badge. A location that isn't a starting location shows it too. Their openings never come up.

## Location Openings
<!-- keywords: start per place, room specific intro, area greeting, different per spawn, place based beginning, parent not inherited -->
<!-- route: worldEditorLocation.openings -->

A location has its own **Openings** tab, its last tab. The rows work the same as the world's openings.

| Rule | Effect |
|---|---|
| **Exact start** | The openings join the draw only when the game starts at this location. A child location never draws its parent's openings. |
| **The world switch** | The **Openings** checkbox turns them off too. |
| **With Self openings** | Location openings stay out of the draw while a persona with Self openings is played. |

## Re-generate on page one
<!-- keywords: reroll, different start, another beginning, retry first page, cycle greetings, same page again -->

**Re-generate** on page one draws again. The game picks an opening it hasn't shown yet in this session. When every opening has been shown, the draw starts over. A world with one opening keeps the same page.

## Chips, search and older worlds
<!-- keywords: variables in intro, my name in intro, legacy world, ai asks what next, ai offers options, pre-filled action, random details per run -->

- **Placeholder chips work in openings.** A Wildcard rolls per playthrough, so the same opening can read differently each time.
- **The Player Name chip works in openings.** Type `{` and pick **Player Name**. Page one then says the [persona](Persona-Authoring#the-player-name-chip)'s name, or "you" when the player has none. A page one that is already written keeps its text when the player changes persona.
- **Search and replace reaches every opening**, on the world and on each entity.
- **A world saved with one pre-filled opening** loads with it as an Opening Action. If that opening was switched off, the list switch starts off, and the text stays.
- **A world saved before openings existed** has none, so the box reads unchecked and the world plays the default opening. Nothing is stored and nothing is lost.

> ⚠️ **An Opening Action is sent as written.** Nothing is added to it. The default opening tells the AI not to ask the player what to do next. Keep a line like that in your own Opening Actions, or the AI may open by offering options.

## Entity Openings
<!-- keywords: npc greeting, character speaks first, npc first message, greeting never shows, card greetings, npc intro rules, added from library -->
<!-- route: worldEditorEntity.openings -->

**Advanced mode only** in the World Editor. The library entity editor always shows it. The **Openings** tab is the last tab. It gives an entity its own openings, so it can start the scene in its own voice. The rows work the same as the world's openings above.

| Rule | Effect |
|---|---|
| **Starting location** | The entity's Others openings join the draw only when it is at the player's starting location. |
| **The world switch** | The world's **Openings** checkbox turns the entity's openings off too, and an entity's openings check that box. An entity has no switch of its own. |
| **Library entity picked at Enter World** | When the player adds a library entity that has openings, the game draws from that entity's openings only. The world switch turns them off with the rest. They also never draw when the world, its locations and its entities have no openings. That world plays the default opening. |
| **Entity card** | The openings and their weights travel with the entity in its [card file](Library#how-to-export-an-entity-or-a-dictionary) and in a published listing. |
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
- **Re-generate draws again from the same Self openings.**
- **Self beats Library Additions.** Who the player plays decides the start before who they brought along.
- **A library persona's Self openings work in any world.** They come with the persona.
- **The world switch covers Self openings.** Off means the default opening.
- **A world persona with no Self openings starts on the normal pool.** Its Others openings still stay out.
- **A library persona with no Self openings uses the Custom Persona's Self openings.** With none there, it starts on the normal pool.
- **A Persona-Only entity's Self openings draw when the player picks it.** Its Others openings never draw.
- **Setting it back to Cast keeps the text.** An entity set back to **Cast** keeps its Self openings in the file. The editor hides them until you set it to a persona choice again.

In the panel, Self openings stay in their owner's group with a **Self** badge.

> 💡 **Write a start for each persona.** Set each persona to **Playable**, add an opening, and select **Self** on it. A player who picks that persona then starts on it.
