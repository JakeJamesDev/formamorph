# 🎬 World Editor: Openings

> 🛠️ Part of the [World Editor](WorldEditor) guide.

**Advanced mode only.** An opening is one way a playthrough can start. Open **Custom Prompts** → **Openings** to write them. When a player presses **Start Game**, the game draws one opening from the list.

Each opening has two buttons, **Player Action** and **Narration**. This choice is its Opens As setting, and it decides where the text lands:

| Opens As | Called | Where the text lands | Who writes page one |
|---|---|---|---|
| **Player Action** | Opening Action | The player's input box. The player can edit it, then sends it. | The AI, from the sent action |
| **Narration** | Opening Narration | Page one itself, shown at once exactly as written. No narration request goes out. | You |

> 💡 **Use Opening Narration to set the voice.** The AI copies the style and length of page one for the rest of the story. A hand-written page one shows it what you want.

After an Opening Narration, the input box is empty. A written page one works like any other page. Choices, stat changes, the clock, read-aloud and the scene image all run on it.

## Weights and chances

| Setting | What it does |
|---|---|
| Weight (the number box) | How often the opening comes up, compared with the others. A missing weight counts as 1. |
| Chance (the percentage beside it) | The share of draws this opening gets, calculated from all the weights. You don't set it. |
| Weight 0 | Keeps the opening in the list and never draws it. Use it to keep a draft. |

Drag a row by its handle to change its place in the list. Order doesn't change the chances.

## The list switch

The checkbox beside **Openings** turns the whole list on or off. Off keeps every row and its text. Players then start on the default opening.

> 💡 **The chances stay visible with the switch off.** They show the odds after you switch the list on. Tune the weights before you publish.

## The default opening

A world with no openings, or with the switch off, starts on the default opening. This is an Opening Action with a general instruction to write the opening scene. The empty list shows its text.

## Every opening in one place

The **Openings** panel shows every opening in the world, grouped by owner:

| Group | Holds |
|---|---|
| **This World** | The world's own openings |
| One group per entity with openings | The openings on that entity's **Openings** tab. The entity's name opens that tab. |

An edit in the panel changes the owner's opening. The switch covers the entity groups too.

A chance is the share of the whole draw at one starting location. World rows and entity rows add up to 100% together. With several starting locations, the **Chances At** picker chooses the location. The pick only changes what the panel shows, and it isn't saved with the world.

| The chance shows | Means |
|---|---|
| **A percentage** | The row can come up at that location |
| **0%** | The row has weight 0, or no text |
| **—** | The entity isn't at that location. A note under the group names the location. |

An entity at no starting location shows a **No Starting Location** badge. Its openings never come up.

## Chips, search and older worlds

- **Placeholder chips work in openings.** A Wildcard rolls per playthrough, so the same opening can read differently each time.
- **The Player Name chip works in openings.** Type `{` and pick **Player Name**. Page one then says the [persona](Persona-Authoring#the-player-name-chip)'s name, or "you" when the player has none. A page one that is already written keeps its text when the player changes persona.
- **Search and replace reaches every opening**, on the world and on each entity.
- **A world saved with one pre-filled opening** loads with it as its first Opening Action. If that opening was switched off, the list switch starts off, and the text stays.

> ⚠️ **An Opening Action is sent as written.** Nothing is added to it. The default opening tells the AI not to ask the player what to do next. Keep a line like that in your own Opening Actions, or the AI may open by offering options.

## Entity Openings

**Advanced mode only** in the World Editor. The library entity editor always shows it. The **Openings** tab gives an entity its own openings, so it can start the scene in its own voice. The rows work the same as the world's openings above.

| Rule | Effect |
|---|---|
| **Starting location** | The entity's openings join the draw only when it is at the player's starting location. |
| **The world switch** | The world's **Openings** checkbox turns the entity's openings off too. An entity has no switch of its own. |
| **Character card** | The openings and their weights travel with the entity in its card file and in a published listing. |
| **Played entity** | When the player plays this entity as their [persona](Persona-Authoring#make-an-entity-playable), its openings leave the draw for that game. |
