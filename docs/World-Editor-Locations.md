# 🗺️ World Editor: Locations

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Locations are the places where your story happens. The player is always in one location. That location decides what the AI reads about the scene: the description, who's present, and where the story can go next.

## Why it exists

Without a fixed place, the narrator loses track of the scene. The tavern becomes a street, then a forest. A location is sent to the AI again on every turn, so the scene stays where you put it.

## How to Add a Location
<!-- keywords: place, area, room, map, create, new place, zone, region -->

1. Open the **Locations** tab.
2. Type the location's name in the **Search or add new locations** box.
3. Select the **+** button (**Add to Locations**). The new location opens in the panel.
4. On the **Details** tab, write the **AI-Facing Description**.
5. Select **Save** at the bottom of the editor.

> 💡 With the box empty, the new location is named "New Location". Rename it in **Name**.

## How to Nest a Location
<!-- keywords: sublocation, child, inside, parent, hierarchy, room in building, indent -->

**In the list:**

1. Select **List** beside the search box.
2. Drag the location by its handle onto the row above it.
3. Move it to the right while you drag. The indent shows that it is now a sub-location.

**On the canvas:**

1. Select **Canvas** beside the search box.
2. Drag the location's box into the box of its new parent. To nest into a location that has no sub-locations yet, hold the drag over it for a moment.
3. To move a location back to the top level, drop it on **Top Level**.

## How to Connect Two Locations
<!-- keywords: link, path, route, travel, road, door, map, one-way -->

**In the panel:**

1. Select one of the two locations, then open its **Presence** tab.
2. Under **Connections**, pick the other location in **Connect to…**.
3. Select the **+** button (**Add Connection**). The new Connection is **Two-Way**.
4. To make it one-way, pick **Outgoing** or **Incoming** on its row.
5. Optional: write a **Travel Hint**.

**On the canvas:** drag from the handle on the right edge of one box (**Drag To Connect**) onto the other box.

## How to Set a Starting Location
<!-- keywords: spawn, begin, point, first place -->

1. Select the location, then open its **Details** tab.
2. Check **Starting Location**.
3. Check it on more locations to let the player pick one. See [Starting Location](#starting-location).

## How to Pin a Placeholder to a Location
<!-- keywords: place, fixed value, override, wildcard, variable, per place -->

**Advanced mode only.**

1. Select the location, then open its **Pins** tab.
2. Select **Add Placeholder Pin**.
3. In the new row, select **Select placeholder** and pick the placeholder.
4. Type the value in **Pinned value**. The box suggests the placeholder's own values, and it also takes any text.

While the player is at this location, the placeholder reads the pinned value. See [Placeholder Pins](#placeholder-pins).

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
| **Canvas** | See how the world connects. Drag to nest, draw Connections, set their direction and Travel Hint, and arrange the layout. It marks a location that no starting location can reach. |

**Edit Full Screen** opens the canvas at full size, with undo and redo, search and a minimap. Right-click a box and select **Edit Location** to open its panel.

Nothing on the canvas moves until you move it or ask for a layout. With nothing selected, **Auto Arrange All** in the toolbar lays out every box. With a box selected, the button reads **Auto Arrange** and lays out only its group. Right-click a location with sub-locations and select **Auto Arrange** to lay out only its children. The in-game map uses your canvas layout.

## The panel

Select a location in the list to open its panel. The tab you pick stays open when you select another location.

| Tab | Holds | Mode |
|---|---|---|
| **Details** | **Name**, **Starting Location** and the descriptions | Simple and Advanced |
| **Presence** | **Entities** and **Connections** | Simple and Advanced |
| **Media** | **Background Image**. In Advanced mode, also **Image Tags** and **Ambient Sound**. | Simple and Advanced |
| **Pins** | **Placeholder Pins** | Advanced only |
| **Openings** | The location's own [openings](World-Editor-Openings#location-openings), drawn when a game starts here | Advanced only |

Simple mode also hides **AI-Facing Summary**.

### Media

| Field | What it does |
|---|---|
| **Background Image** | The image behind the story while the player is here. Upload a file, or paste an address into **Or paste an image URL**. See [Upload or link](World-Editor-Overview#upload-or-link). **Generate with AI** makes one when [image generation](Image-Generation#how-to-turn-on-image-generation) is on in Settings. |
| **Image Tags** | **Advanced mode only.** Booru tags for AI image generation |
| **Ambient Sound** | **Advanced mode only.** A sound that plays while the player is here. Select **Add Sound** to pick a file. |

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

Pick a place in **Connect to…**, then select the **+** button (**Add Connection**).

### Travel Hints

A **Travel Hint** is optional, and it goes to the AI: *through the shimmering portal*, *down the rope ladder*. It tells the story how the player makes the trip.

Each direction has its own hint. The AI gets the hint for the direction the player travels. A direction with no hint gets none. The AI never uses the other direction's words.

| Connection | Hint boxes |
|---|---|
| **Two-Way** | Two boxes, one for each direction. A **link toggle** sits to the right of both. |
| **Outgoing** or **Incoming** | One box. There is no toggle. |

On a location's panel, the boxes read **To** *place* and **From** *place*. On the Canvas, each box shows an arrow and the place it leads to.

The link toggle joins the two boxes:

- 🔗 **Linked.** The first hint applies to both directions. The second box is read-only and shows the first box's text.
- 💔 **Unlinked.** Both boxes are editable and hold separate hints.

A new two-way Connection starts linked. One hint covers both directions until you unlink.

- Select **Unlink Travel Hints** to write a different hint for the return trip. The second box gets back the text it held before you linked.
- Select **Link Travel Hints** to copy the first hint into the second direction.
- Two boxes with the same text open linked. Two boxes with different text open unlinked.

> 💡 The editor doesn't save the link state. It reads the state from the hints each time you open the panel. The text the second box held before you linked is lost when you close the panel.

Change a Connection to one-way, and it keeps the hint for the direction that remains. Change it back to two-way, and the new direction starts with a copy of that hint.

On the Canvas, each arrow shows its own hint as a label. Two arrows with the same hint share one label. Select an arrow to edit that direction's hint. Undo and redo cover the toggle and every hint edit.

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
- Its Connections are deleted.
- Nothing asks you to confirm.
- Each entity that was there loses this location. See the warning on the [Entities page](World-Editor-Entities#locations).

