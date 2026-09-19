# 🗺️ World Editor: Locations

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Locations are the places where your story happens. The player is always in one location. That location decides what the AI reads about the scene: the description, who's present, and where the story can go next.

## Why it exists

Without a fixed place, the narrator loses track of the scene. The tavern becomes a street, then a forest. A location is sent to the AI again on every turn, so the scene stays where you put it.

## Nesting is the AI's map, not the player's

> 💡 **The player can always travel anywhere.** The in-game location list and the in-game map offer **every** location in your world. Nesting never limits the player, and no arrangement can trap them.

Nesting decides where **the story** can take the player. When the AI reads an action as movement, it considers only the places connected to the current one:

| From | The story can move the player |
|---|---|
| A **top-level** location | Down into its sub-locations |
| A **sub-location** | Down into its children, **up** to its parent, and **sideways** to its siblings |

A [Connection](#connections) between two places replaces these rules for that pair.

By default the story offers the move. The player sees a small **Move to _X_?** prompt with **Go** and **Dismiss**.

Two results to know:

- **A flat list of top-level locations** gives the AI nothing to connect, so it never offers a move. The player then does all the travel. This is a valid design when you choose it on purpose.
- **A location with no connected place** gets no move step.

When the AI's answer doesn't match a connected place, the game discards it and offers nothing. The story can never send the player to an unconnected place.

## List and Canvas

The **Locations** tab has two views. Switch between them with **List** and **Canvas**.

| View | Use it to |
|---|---|
| **List** | Edit a location's fields. Drag a location under another to nest it. |
| **Canvas** | See how the world connects. Drag to nest, draw Connections, set their direction and Travel Hint, and arrange the layout. It has undo and redo, search, a minimap and fullscreen. It marks a location the story can't reach. |

Nothing on the canvas moves until you move it or ask for a layout. The in-game map uses your canvas layout.

## The panel

Select a location in the list to open its panel.

| Tab | Holds | Mode |
|---|---|---|
| **Details** | **Name**, **Starting Location** and the descriptions | Simple and Advanced |
| **Presence** | **Entities** and **Connections** | Simple and Advanced |
| **Media** | **Background Image**, **Image Tags** and **Ambient Sound** | Simple and Advanced |
| **Pins** | **Placeholder Pins** | Advanced only |

Simple mode hides **AI-Facing Summary**, **Ambient Sound** and **Image Tags**.

## What reaches the AI

| Field | Sent? |
|---|---|
| **Name** | Always |
| **AI-Facing Description** | Yes. This is the main text the AI uses. |
| **AI-Facing Summary** | Only in prompt slots that ask for the short form |
| **Player-Facing Description** | **Never** |
| Background image, Image Tags, ambient sound, the starting checkbox, nesting | Never |

The default prompt gives the **narrator** the current location in full. It gives the sub-locations and reachable places as summaries.

> ⚠️ **Only the narrator gets the full description.** The other steps get the **summary** of the current location: the choice writer, the continuity planner and the location router. Text that is only in the full description reaches the narrator and no other step. This matters for a random-event list or a rule about the place. With a blank summary, those steps use the full text.

> 💡 **The player reads only the Player-Facing Description, and the AI reads only the AI-Facing fields.** Put a secret in the AI-Facing Description.

The **✨ toolbar** beside **AI-Facing Summary** can write a draft from your AI-Facing Description. A blank summary is fine. The game uses the full description in its place.

## Entities

The **Entities** picker on the **Presence** tab lists who's at this location. Each entity stores its own locations, so an edit here changes the entity's **Locations** field. It's the same link, and you can set it from either side.

## Connections

Nesting gives travel for free, and it always goes both ways. A **Connection** is a link you make between *any* two locations, at any place in the tree.

The **Connections** section lists every link this location is part of, from this location's point of view:

| Direction | Means |
|---|---|
| **Two-Way** | The story can move the player in both directions. A new Connection starts as this. |
| **Outgoing** | The story can leave here for the other place. It can never bring the player back. |
| **Incoming** | The story can arrive here from the other place. It can't go the other way. |

Pick a place from the **Connect to…** dropdown and press **Add Connection**. The **Travel Hint** box is optional, and it goes to the AI: *through the shimmering portal*, *down the rope ladder*. It tells the story how the player makes the trip.

> ⚠️ **A Connection replaces the free travel those two places had.** This is what makes a one-way link truly one-way, even between two sub-locations of the same place. The story is never offered the trip back.

One Connection is one link, so it shows on **both** locations' panels. Change it or delete it from either side.

> 💡 Connections limit the story only, the same as nesting. The player's own location list still shows every location.

## Placeholder Pins

**Advanced mode only.** A pin on the **Pins** tab keeps a [placeholder](World-Editor-Placeholders#pins) at one value while the player is here. For example, the *Fen* pins Weather to *fog*. When the player leaves, the playthrough's own roll shows again. A sub-location doesn't get its parent's pins.

## Starting Location

The **Starting Location** checkbox marks a place where a new game can start:

| Checked on | Result |
|---|---|
| **No location** | The game starts at a **random location, any of them**. You rarely want this. |
| **One** | Every game starts there |
| **Several** | The player picks one before they start, or the game picks one at random |

## Delete a location

- Its sub-locations move up to its parent. They aren't deleted.
- Its Connections stop working.
- Each entity that was there loses this location. See the warning on the [Entities page](World-Editor-Entities#locations).

## Getting started

Write the AI-Facing Description first. Nest locations when you want the story to move the player on its own. Add Connections where nesting can't make the link you want. Check **Starting Location** on one location at least, so a new game doesn't start at a random place.
