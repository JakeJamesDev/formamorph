# 🗺️ World Editor: Locations
<!-- keywords: scenes, environments, world geography, where player is, venues -->
<!-- route: worldEditor.locations -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Locations are the places where your story happens. The player is always in one location. That location decides what the AI reads about the scene. The AI reads the location's description, the entities present, and where the story can go next.

## Why it exists
<!-- keywords: ai forgets where, scene keeps changing, random teleport, setting drifts, keep scene consistent -->

Without a fixed place, the narrator loses track of the scene. The tavern becomes a street, then a forest. A location is sent to the AI again on every turn, so the scene stays where you put it.

## How to Add a Location
<!-- keywords: place, area, room, map, create, new place, zone, region, town, city, building, dungeon, scene, environment, spot, venue -->
<!-- route: worldEditor.locations#list-toolbar -->

1. Open the **Locations** tab.
2. Type the location's name in the **Filter Locations** box.
3. Select the **+** button (**Add to Locations**). The new location opens in the panel.
4. On the **Details** tab, write the **AI-Facing Description**.
5. Select **Save**.

> 💡 With the box empty, the new location is named "New Location". Rename it in **Name**.

## How to Nest a Location
<!-- keywords: sublocation, child, inside, parent, hierarchy, room in building, indent, subfolder, tree, contain, put within, floors, district, drag under, un-nest, group places -->
<!-- route: worldEditor.locations#list-toolbar -->

**In the list:**

1. Select **List** beside the filter box.
2. Drag the location by its handle onto the row above it.
3. Move it to the right while you drag. The indent shows that it is now a sub-location.

**On the canvas:**

1. Select **Canvas** beside the filter box.
2. Drag the location's box into the box of its new parent. To nest into a location that has no sub-locations yet, hold the drag over it for a moment.
3. To move a location back to the top level, drop it on **Top Level**.

## How to Connect Two Locations
<!-- keywords: link, path, route, travel, road, door, map, one-way, exit, passage, portal, bridge, adjacent, neighbor, hallway, arrow -->
<!-- route: worldEditor.locations -->

**In the panel:**

1. Select one of the two locations, then open its **Presence** tab.
2. Under **Connections**, pick the other location in **Connect to…**.
3. Select the **+** button (**Add Connection**). The new Connection travels **Both Ways**.
4. To make it one-way, pick **To There** or **To Here** under **Travel** on its row.
5. Optional: write a **Travel Hint**.

**On the canvas:** drag from the handle on the right edge of one box (**Drag To Connect**) onto the other box.

## How to Set a Starting Location
<!-- keywords: spawn, begin, point, first place, where game opens, initial, default place, origin, let player choose -->
<!-- route: worldEditorLocation.details -->

1. Select the location, then open its **Details** tab.
2. Check **Starting Location**.
3. Check it on more locations to let the player pick one. See [Starting Location](#starting-location).

## How to Pin a Placeholder to a Location
<!-- keywords: place, fixed value, override, wildcard, variable, per place, weather per area, depends on where, local wording, text by room, force while here, area specific -->
<!-- route: worldEditorLocation.pins -->

**Advanced mode only.**

1. Select the location, then open its **Pins** tab.
2. Select **Add Placeholder Pin**.
3. In the new row, select **Select placeholder** and pick the placeholder.
4. Type the value in **Pinned value**. The box suggests the placeholder's own values, and it also takes any text.

While the player is at this location, the placeholder reads the pinned value. See [Placeholder Pins](#placeholder-pins).

## Nesting is the AI's map, not the player's
<!-- keywords: trapped, cant leave, restrict movement, lock an area, story never moves, auto travel, fast travel, move prompt, up down sideways -->

> 💡 **The player can always travel anywhere.** The in-game location list and the in-game map offer **every** location in your world. Nesting never limits the player, and no arrangement can trap them.

Nesting decides where **the story** can take the player. When the AI reads an action as movement, it considers only the places connected to the current one:

| From | The story can move the player |
|---|---|
| A **top-level** location | Down into its sub-locations |
| A **sub-location** | Down into its children, **up** to its parent, and **sideways** to its siblings |

A [Connection](#connections) between two places replaces these rules for that pair.

🚶 **One turn can cover up to three of these steps.** "Walk down the lane to town and step into the store" can take the player from a farm building to a store three steps away. Each step follows the rules above, so a one-way Connection is never walked backward. A place four or more steps away is out of reach, and the player stays where they are.

The AI gets each place more than one step away with the places on the way: *Store — via Farm Yard, then Town*. When two places in reach share a name, the nearer one counts. When they are equally near, neither does. A place with the same name as the player's current location never counts.

By default the story offers the move. The player sees a small **Move to _X_?** prompt with **Go** and **Dismiss**. The AI reads the action and the scene it led to, so a scene that carries the player somewhere offers that move too.

With **Move Automatically** on in Settings, the game moves the player itself:

- 🚶 **The player's action** moves them before the scene is written, so the scene happens in the new place. A place more than one step away counts only when the AI answers with its name alone. An answer that mentions it in a sentence moves the player nowhere.
- 📖 **The narration** moves them too. When the action moves them nowhere but the narration ends with them in a connected place, the game moves them there after the narration. This includes the opening narration.
- 👥 Followers come along either way, and an entity told to stay waits where it is. On a walk of several steps they arrive at the last place. A follower that may not go there stays behind and waits.

Two results to know:

- **A flat list of top-level locations** gives the AI nothing to connect, so it never offers a move. The player then does all the travel. This is a valid design when you choose it on purpose.
- **A location with no connected place** gets no move step.

When the AI's answer doesn't match a place in reach, the game discards it and offers nothing. The story can never send the player to a place out of reach.

## List and Canvas
<!-- keywords: graph view, node editor, visual diagram, fullscreen, tidy layout, boxes overlap, unreachable marker, right-click menu, flowchart -->
<!-- route: worldEditorLocations.list -->

The **Locations** tab has two views. Switch between them with the **List** and **Canvas** icon buttons to the right of the filter box.

| View | Use it to |
|---|---|
| **List** | Edit a location's fields. Drag a location under another to nest it. |
| **Canvas** | See how the world connects. Drag to nest, draw Connections, set their direction, distance and Travel Hint, and arrange the layout. It marks a location that no starting location can reach. |

> 💡 In the List view, **Collapse all locations**, right of the filter box, closes every group of sub-locations. Select it again to open them all. Groups stay closed when you switch tabs, until you close the World Editor. The button is unavailable while you filter, in the Canvas view, and when no location has sub-locations.

**Edit Full Screen** opens the canvas at full size, with undo and redo, search and a minimap. Right-click a box and select **Edit Location** to open its panel.

In full screen, the toolbar and the right-click menus also align, distribute and snap boxes, and set the Connection style. An entity card there sets one entity's **Locations** or **Known In** by selecting boxes.

With **Known In** set to **Nearby**, the canvas shows where the AI gets the entity's summary:

- 📍 **Can Be Here.** Every location the entity's routine uses: where it begins and each location a row names.
- 👂 **Known Here While It Is Nearby.** Every location one **Nearby** link from those. The AI gets its summary there only while the entity stands at the marked neighbor.
- ⋯ A **Far** link draws dotted, and its other end stays unmarked. See [Nearby and Far](#nearby-and-far).

Nothing on the canvas moves until you move it or ask for a layout:

- Right-click an empty part of the canvas and select **Auto Arrange All** to lay out every box.
- In full screen, the toolbar holds the same button. With a box selected, it reads **Auto Arrange** and lays out only its group.
- Right-click a location with sub-locations and select **Auto Arrange** to lay out only its children.

The in-game map uses your canvas layout.

### Map Background
<!-- keywords: world map image, map art, picture behind canvas, trace a map, background image on map, map opacity, ruined map, map changes -->

A **Map Background** is an image behind the boxes, such as a hand-drawn world map. The player's in-game Map shows it in the same place, at the same size and opacity.

1. Right-click an empty part of the canvas and select **Set Background Image…**.
2. Upload a file, or paste an image address. The image covers your locations.
3. The **Adjust Background** card opens. Drag the image to move it. Drag a corner to resize it. The image keeps its shape.
4. Set **Opacity**, then close the card.

- 🔒 **Locked.** Outside Adjust, the image never moves. Dragging, selecting and connecting boxes work as usual.
- 🎚️ **Adjust Background.** Right-click an empty part of the canvas to turn it on or off. The boxes stay on top but don't move, so a drag anywhere on the image moves it. The card also holds **Remove Image**.
- 🖼️ **Replace Background Image…** opens the map's gallery, the same one the **Media** tab shows. Select a tile to frame it, drag a tile to reorder, or select **x** to remove the framed image. The canvas shows the first image.
- 🗑️ Removing the last image also clears its place and opacity. The next image is placed like a first one: over your locations, or over the visible canvas when there are none.
- ↩️ Each drag, resize, removal, or opacity change is one undo step.

The **Media** tab can hold more than one map image, each with its own [Visibility rule](World-Editor-Entities#visibility-rules). During a game, the Map shows the first visible image, all in the same frame. A condition with no owner reads the persona, as on a location. The canvas always shows the first image. See [Map Background in the Media tab](World-Editor-Media#map-background).

## The panel
<!-- keywords: backdrop, wallpaper, scenery picture, looping noise, atmosphere audio, generate scenery, rain sfx -->
<!-- route: worldEditorLocation.details -->

Select a location in the list to open its panel. The tab you pick stays open when you select another location.

| Tab | Holds | Mode |
|---|---|---|
| **Details** | **Name**, **Starting Location** and the descriptions | Simple and Advanced |
| **Presence** | **Entities**, **Entities Here**, **Known Here** and **Connections** | Simple and Advanced |
| **Items** | The location's [Starting Items](World-Editor-Items#starting-items) | Simple and Advanced |
| **Media** | **Background Image**. In Advanced mode, also **Image Tags** and **Ambient Sound**. | Simple and Advanced |
| **Pins** | **Placeholder Pins** | Advanced only |
| **Openings** | The location's own [openings](World-Editor-Openings#location-openings), drawn when a game starts here | Advanced only |

Simple mode also hides **AI-Facing Summary**.

### Media

| Field | What it does |
|---|---|
| **Background Image** | A gallery of images behind the story while the player is here. Upload a file, or paste an address into **Or paste an image URL**. See [Upload or link](World-Editor-Overview#upload-or-link). **Generate with AI** makes one when [image generation](Image-Generation#how-to-turn-on-image-generation) is on in Settings. Drag a thumbnail to reorder. |
| **Image Tags** | **Advanced mode only.** Booru tags for AI image generation |
| **Ambient Sound** | **Advanced mode only.** A sound that plays while the player is here. Select **Add Sound** to pick a file. |

### Background Visibility rules
<!-- keywords: change background in game, wounded backdrop, night backdrop, conditional background, background per state, backdrop follows story -->

Each background image can carry a [Visibility rule](World-Editor-Entities#visibility-rules), the same as an entity image. Select the cog on a thumbnail to set one.

- 🖼️ During a game, the backdrop shows the **first visible image**, counting from the left.
- 🧍 A condition with no owner reads the **persona** the player plays. A location has no traits or stats of its own. Pick an entity to read that entity instead. A global trait or stat needs no owner.
- 🌫️ When no image is visible, the story shows no backdrop.

Example: put a *wounded* backdrop first with the rule *Health < 20%*, and a calm one after it with no rule. The backdrop swaps while the persona is hurt.

## What reaches the AI
<!-- keywords: random events list, choices ignore rules, narrator vs other steps, hidden room details, short form used, ai misses details -->

| Field | Sent? |
|---|---|
| **Name** | Always |
| **AI-Facing Description** | Yes. This is the main text the AI uses. |
| **AI-Facing Summary** | Only in prompt slots that ask for the short form |
| **Player-Facing Description** | Only with scene images on, when **Image Tags** and the **AI-Facing Description** are both blank: the AI turns it into image tags |
| **Image Tags** | Not to the text AI. Sent to the image generator for [scene images](Image-Generation#scene-images). |
| Nesting | As the **Sublocations** and **Reachable Locations** blocks, and the parent's name in the default *Now you are at* line |
| **Travel Hint** | Yes, beside the place it leads to, when that place is one step away |
| **Known Here** | Yes, as the **Entities Known Here** block. See [Entities](#entities). |
| Background image, ambient sound, the starting checkbox | Never |

The default prompt gives the **narrator** the current location in full. It gives the sub-locations and reachable places as summaries.

> ⚠️ **Only the narrator gets the full description.** Every other AI step gets the **summary** of the current location, such as the step that writes the choices. Text that is only in the full description reaches the narrator and no other step. This matters for a random-event list or a rule about the place. With a blank summary, those steps use the full text.

> 💡 **The player reads only the Player-Facing Description, and the AI reads only the AI-Facing fields.** Put a secret in the AI-Facing Description.

**Generate summary** beside **AI-Facing Summary** writes a draft from your AI-Facing Description. It is a ✨ icon button, and its tooltip reads "Generate summary from the description". **Generate player-facing description** and **Generate AI-facing description**, ✨ icon buttons beside the two descriptions, draft each one from the other. A blank summary is fine. The game uses the full description in its place.

## Entities
<!-- keywords: who is here, npcs in room, assign characters, populate, residents, occupants, put npc here -->
<!-- route: worldEditorLocation.presence -->

The **Entities** picker on the **Presence** tab lists your Generic entities, such as a crowd or a herd. An edit here adds or removes where an entity begins, the same as on its **Routine** tab.

A Unique entity isn't in this picker. Set where it begins on the entity's **Routine** tab, or click a location on the full-screen Locations Canvas.

Pick a Generic entity to make it begin at this location. It gets a new place to begin here with no rows, and you add rows on its **Routine** tab. Clear it to remove every place it begins at here, with their rows. Its other places stay as they are. **Undo** brings them all back in one step.

A Generic entity that begins at no other location can't be cleared. It stays picked, and a line under the picker says so. Give it another place to begin on its **Routine** tab, then clear it here.

**Entities Here** lists every entity that can be at this location, one line each, with the reason. The list is read-only. Select the route icon on a line to open that entity's **Routine** tab and change it there.

| Reason | Means |
|---|---|
| **Begins here** | The entity begins at this location. A Unique entity with several places to begin gives the chance as a percent. |
| **Stays here**, **wanders here**, **patrols here** | A routine row uses this location. The line gives the row's time. |
| **Can be led here** | The Unique entity's **Traversable** list names this location. A Unique entity that can go **Anywhere** isn't listed for that reason. A Generic entity is never listed for it. |

An entity with several reasons shows them on one line.

A Generic entity begins at all of its places, so its line shows no chance. It shows each reason once, however many of its places use this location.

- **Known Here** lists entities that aren't at this location but that the entities here may speak of. Their summaries reach the AI anywhere inside this location. Add one with **Make an entity known here**.

### Who Joins the Scene
<!-- keywords: npc walks in, character comes over, pulled into scene, joins the player, comes down, comes from next room, wont come, stays at counter -->

When the narration names an entity that stands one **Nearby** link away, that entity comes to the player's location. One link away means one of these places:

- The location the player's location sits **inside**: one level up.
- A location **beside** the player's: it shares the same parent.
- A location **directly inside** the player's: one level down. Two levels down is too far.
- The other end of a **Connection** from the player's location, in either direction.

A **Far** link never brings anyone over, even a nested one. See [Nearby and Far](#nearby-and-far).

The narration must use the entity's full Name, a full alias, or the full **Stranger Name**. A name said only inside dialogue doesn't count.

Only a **Unique** entity comes, and only to a location it may go to. A **Generic** entity never comes over. One that is following the player, or waiting where it was left, doesn't come either. Nor does one in a part of its routine that can't be interrupted.

The entity goes back to its usual places later: when the player leaves, or after a while. Undo the turn, and it goes back at once.

## Connections
<!-- keywords: no way back, both directions, trip description, how you get there, return trip wording, arrow labels, trapdoor, shortcut across branches -->

Nesting lets the story move the player between nested places, always in both directions. A **Connection** is a link you make between *any* two locations, at any place in the tree.

The **Connections** section lists every link this location is part of, from this location's point of view. Each Connection has three fields: **Travel**, **Distance** and its Travel Hints.

**Travel** sets which way the story can move the player:

| Travel | Means |
|---|---|
| **Both Ways** | The story can move the player in both directions. A new Connection starts as this. |
| **To There** | The story can leave here for the other place. It can never bring the player back. |
| **To Here** | The story can arrive here from the other place. It can't go the other way. |

On the Canvas, the Travel choices show only arrows. Point at one to see which place it leads from and to.

Pick a place in **Connect to…**, then select the **+** button (**Add Connection**).

### Nearby and Far

Every link between two places is **Nearby** or **Far**. The AI receives the entities in Nearby places as nearby. It never hears about the entities across a Far link.

| Distance | Means |
|---|---|
| **Nearby** | The AI receives the entities at the other end as nearby. Every nested link and every new Connection is this. |
| **Far** | The AI gets nothing about the entities at the other end. Travel still works. |

Only places one link away count. A place two links away is never nearby.

To set it, pick **Nearby** or **Far** under **Distance** on the Connection's row in the **Presence** tab, or select the Connection's arrow on the **Canvas**. Both set the same value. Each choice shows a mark: a short line for Nearby, a dotted wave for Far. Select the **ⓘ** beside **Distance** for the full explanation. A Far arrow draws as a dotted line, on the Canvas and on the player's Map.

To make a nested link Far, select its dashed arrow on the Canvas. That turns it into a two-way Connection. Then pick **Far**. Delete the Connection to make the link Nearby again.

### Travel Hints

A **Travel Hint** is optional, and it goes to the AI: *through the shimmering portal*, *down the rope ladder*. It tells the story how the player makes the trip.

Each direction has its own hint. The AI gets the hint for the direction the player travels. A direction with no hint gets none. The AI never uses the other direction's words. A place more than one step away shows the places on the way instead of a hint.

| Connection | Hint boxes |
|---|---|
| **Both Ways** | Two boxes, one for each direction. A **link toggle** is to the right of both. |
| **To There** or **To Here** | One box. There is no toggle. |

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

> ⚠️ **A Connection replaces the travel that nesting gives those two places.** This is what makes a one-way link truly one-way, even between two sub-locations of the same place. The story is never offered the trip back.

One Connection is one link, so it shows on **both** locations' panels. Change it or delete it from either side.

> 💡 Connections limit the story only, the same as nesting. The player's own location list still shows every location.

## Placeholder Pins
<!-- keywords: wording per area, child doesnt inherit, reverts on leaving, local override, climate by region -->
<!-- route: worldEditorLocation.pins -->

**Advanced mode only.** A pin on the **Pins** tab keeps a [placeholder](World-Editor-Placeholders#pins) at one value while the player is here. For example, the *Fen* pins Weather to *fog*. When the player leaves, the playthrough's own roll shows again. A sub-location doesn't get its parent's pins.

## Starting Location
<!-- keywords: random spawn, always same start, choose where to begin, several spawns, wrong first place, none checked -->

The **Starting Location** checkbox marks a place where a new game can start:

| Checked on | Result |
|---|---|
| **No location** | The game starts at a **random location, any of them**. You rarely want this. |
| **One** | Every game starts there |
| **Several** | The player picks one before they start, or the game picks one at random |

A world persona starts at the first of its own **Locations** that is a starting location, or else at its first location. The start step also lists the persona's locations.

## Delete a location
<!-- keywords: children afterwards, no confirmation, accidentally removed, npc vanished, undo removal -->

Each row in the list has **Duplicate** and **Delete** actions. When you delete a location:

- Its sub-locations move up to its parent. They aren't deleted.
- Its Connections are deleted.
- The Starting Items placed there are deleted, and it leaves every entity's **Known In** picks.
- Nothing asks you to confirm.
- Each entity that was there loses this location. See the warning on the [Entities page](World-Editor-Entities#locations).

