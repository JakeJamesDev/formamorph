# 🎭 World Editor: Entities
<!-- keywords: characters, npcs, monsters, companions, cast list, items objects, bots -->
<!-- route: worldEditor.entities -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

An entity is a person, a creature, an object or a fixture in your world: a ferryman, an eel-smoker, a barred door. An entity belongs to one or more **Locations**. The AI reads the entities that can show up where the player is.

## Why it exists
<!-- keywords: ai forgets characters, narrator invents people, recurring character, persistent npc, keeps renaming -->

Without entities, the narrator invents a stranger, names them, and forgets both by the next turn. An entity is a fixed person or object that the story can come back to. The AI reads about it again each time the player is at one of its locations.

The default prompt lists the entities that **may** appear in the current location. That wording is a hint to the AI. The game doesn't enforce it, and the narrator can use any entity on the list. You can change the wording in the [prompt editor](Prompts#how-to-edit-a-prompt).

## How to Add an Entity
<!-- keywords: character, npc, create, new character, make, person, monster, companion, creature, bot, villain, love interest, pet, party member, enemy, add someone -->
<!-- route: worldEditor.entities#list-toolbar -->

1. Open the **Entities** tab.
2. Type the entity's name in the **Filter Entities** box.
3. Select the **+** button (**Add to Entities**), then select **Add Entity**.
4. The new entity opens in the panel. On the **Profile** tab, pick one or more places in **Locations**.
5. On the **Descriptions** tab, write the **AI-Facing Description**.
6. Select **Save**.

> 💡 With the box empty, the new entity is named "New Entity". Rename it in **Name**.

To add a copy of an entity from your library, select the **+** button, then **Add From Library…**.

## How to Import a SillyTavern Card
<!-- keywords: character, tavern, png, chub, st, bring in, load character, character card, janitor, v2 card, tavernai, bot file, convert card, risu, upload card, lorebook comes along -->
<!-- route: worldEditor.entities -->

1. On the Main Menu, open the library's **Entities** tab.
2. Select **Import Entity**.
3. Pick the card's `.png` or `.json` file.
4. The card joins your library:
   - The card becomes an entity.
   - A PNG card's image becomes the entity's image.
   - A JSON card brings an image only when its avatar is a web address.
   - The card's lorebook, if it has one, joins your library as a dictionary.
5. In the World Editor, open the **Entities** tab, select the **+** button, then select **Add From Library…**.
6. Select the entity, then select **Add Entity** in the window.

> 💡 You can pick several files at once. A SillyTavern persona backup `.json` imports as personas.

You can also import a card directly into a world. On the **Entities** tab, select the **+** button, then **Import Entity…**. Pick the file, keep or clear **Link through my library**, and select **Add Entity**. This route doesn't bring in the card's lorebook.

See [SillyTavern cards](#sillytavern-cards) for what each part of the card becomes.

## How to Give an Entity an Opening
<!-- keywords: first message, greeting, intro, start, character start, npc speaks first, opener, hello line, begins the scene, initial dialogue, welcome line -->
<!-- route: worldEditorEntity.openings -->

**Advanced mode only** in the World Editor.

1. Select the entity, then open its **Openings** tab.
2. Select the **+** button (**Add Opening**).
3. Write the opening's text.
4. Choose **Player Action** or **Narration**. See [Openings](World-Editor-Openings) for the difference.
5. Make sure the entity is in a **Starting Location**. Its openings draw only when it is at the player's starting location.

See [Entity Openings](World-Editor-Openings#entity-openings) for when they draw.

## The panel
<!-- keywords: pronouns, gender, profile tab, cast or playable, category, can player be them, seven tabs, relationships -->
<!-- route: worldEditorEntity.profile -->

Select an entity to open its panel.

| Tab | Holds | Mode |
|---|---|---|
| **Profile** | **Name**, **Pronouns**, **Relationships**, the **Image** and the **Avatar** dropdown (**None**, **User's Default**, or an Avatar of the world; see [World Avatars](Avatars#world-avatars)). In Advanced mode, also **Aliases**, [**Stranger Name**](#stranger-name) beside **Name**, the **Persona** control, **Type**, **Image Tags** and the **3D Model**. | Simple and Advanced |
| **Descriptions** | **Player-Facing Description** and **AI-Facing Description**. In Advanced mode, also [**Stranger Description**](#stranger-description) under **Player-Facing Description**, and **AI-Facing Summary**. | Simple and Advanced |
| **Items** | The entity's [Starting Items](World-Editor-Items#starting-items) | Simple and Advanced |
| **Routine** | Where the entity stands, where it starts, and its [daily routine](#routine) | Simple and Advanced |
| **Traits** | The entity's own [traits](World-Editor-Traits#entity-traits) | Advanced only |
| **Stats** | The entity's own [stats](#entity-stats) | Advanced only |
| **Placeholders** | The entity's own [placeholders](World-Editor-Placeholders#placeholders-that-belong-to-an-entity-or-a-dictionary) | Advanced only |
| **Openings** | The entity's own openings, including Self openings for a playable entity | Advanced only |

The **Persona** control has four choices: **Cast**, **Playable**, **Persona-Only** and **Custom Persona**. It decides whether the player can play as the entity. See [Personas for Authors](Persona-Authoring#how-to-make-an-entity-playable). For an entity marked **Playable** or **Persona-Only**, its **Locations** are also where the player can start as it.

**Relationships** lists how the entity relates to others. Pick a target, **Persona** or another entity, then type what the target is to this entity. See [Relationships](#relationships).

**Known In** is set on the full-screen Locations Canvas. See [World Editor: Locations](World-Editor-Locations#entities).

| Known In | The AI gets the entity's summary |
|---|---|
| **Nearby** | At locations one **Nearby** link from where the entity is now. Never across a **Far** link. The canvas marks every location this can be. |
| **Nowhere** | Only at its own location |
| **Picked Locations** | Anywhere inside the locations you pick |

Each entity in the list has **Duplicate** and **Delete** actions.

## Routine
<!-- keywords: schedule, daily routine, where does the npc start, npc moves, wander, patrol, stays at, follow the player, called over, unique, generic, crowd, herd -->
<!-- route: worldEditorEntity.routine -->

The **Routine** tab sets where the entity stands in the world.

**Placement** has two choices:

- **Unique**: one character in one location at a time. A new entity is **Unique**. During the game it can move, follow the player and be left waiting.
- **Generic**: a type of character, such as a crowd or a herd. One begins at every start at the same time, and each moves on its start's routine. It never follows and is never called over.

### Starts

Every entity has one or more starts. Each start is a location and a routine kept from there.

- 🎲 A **Unique** entity begins at one start, picked at random in each new game. Each start's tab shows its chance.
- 👥 A **Generic** entity begins at every start at the same time. Its tabs show no chance, its rows have no lock, and it has no **Can Also Go**.
- ✏️ Click the location in **Starts at …** to change it. For a **Unique** entity with several starts, click the percent to set the start's **Weight**.
- ➕ Use **+** beside the tabs to add a start. A start's own delete button removes it. The last start can't be deleted.

Switching between the two keeps every start and row. Chances, locks and **Can Also Go** come back as they were.

#### Player's Starting Location

Pick **Player's Starting Location** at the top of a start's location list. The entity then begins wherever the player begins, in a world with one starting location or many. It adds no location to the entity's list.

- 🤝 For a **Unique** entity, tick **Follows the Player** to make a companion. In a game that picks this start, it travels with the player from the first turn, even through a locked row. **Can Also Go** still applies: it waits outside a location it can't enter.
- 👥 A **Generic** entity begins beside the player and then keeps its routine. It never follows.
- 📍 The start's rows can use any location. In play, the game skips a location the player's real start doesn't connect to.
- 🔁 Moving the start to a fixed location clears **Follows the Player**.

### The routine

The routine reads as sentences in the order of the day, such as *Morning – Afternoon, stays at Smithy.*

- 🕑 Click the time to change it. Times use dayparts. **Use Hours** switches the row to exact hours, and **Use Dayparts** switches back, snapping to the dayparts that cover those hours.
- 🚶 Click the verb to pick **Stay**, **Wander** or **Patrol**.
  - **Stay** keeps it at one location.
  - **Wander** moves it between locations at random. A higher **Weight** picks a location more often. It waits the set time between moves.
  - **Patrol** walks the stops in order, waits at each, then starts over. Drag a stop to change the order.
- 📍 Click the locations to change them. The pickers list only locations the start location connects to.
- 🔒 The lock beside a row stops the entity from being called over or starting to follow the player during that time. The lock on a free-time line does the same for every hour no row covers: it adds a locked **All Day** row at the start location.
- ☕ Hours no row covers read *…, stays at* the start location. **All Day** covers the whole day, and reads *The rest of the day* beside timed rows.

A bar above the sentences shows the whole day, from **Dawn** on the left to the end of **Night** on the right. Each row is a band in its action's color, and free hours are striped.

- 👆 Click a band or a sentence to select that row in both places.
- ↔️ Drag either end of a band to change its time. It snaps to dayparts or to whole hours, whichever the row uses, and stops at the next row. A band dragged across the whole bar becomes **All Day**; drag an end back in to give it hours again.
- 🔁 A row that ends at the bar's right edge can carry on into the next morning: drag that end to the left side of the bar. A row that starts at the left edge can reach back into the night the same way.
- ✋ Drag a band by its middle to move the whole row. An hours row keeps its length and moves by whole hours. A daypart row keeps its number of dayparts. It lands in the nearest free time, and the left and right arrow keys do the same.
- ➕ Click a striped stretch to add a **Stay** at the start location for exactly those hours.

Two timed rows can't share an hour. Times another row uses are unavailable in the pickers, and the add buttons turn off once timed rows fill the day.

⚠️ A listed location that a later link change disconnects stays in its row with a warning. The game skips it until it connects again.

### Can Also Go

**Can Also Go** sets where the entity may go beyond its routine: following the player, or being called over.

- **Anywhere**: any location.
- **Only Listed Locations**: its routine locations and the ones you list. A listed location doesn't include the locations inside it.

### On the Locations Canvas

On the full-screen Locations Canvas, choose the entity and pick **Routine**. The map shows the routine of the start whose tab is open. Each location takes its action's color, a bar shows when the entity is there, and a flag marks **Starts Here**. A start at the **Player's Starting Location** has no flag, and every location shows as one its rows can use. A key at the bottom lists what the map shows.

- 👆 Select a row to edit its locations: click a location, or drag from one. The line over the map says what a click does.
- 📍 Under **Only Listed Locations** with no row selected, a click adds the location to **Can Also Go** or removes it.

A **Generic** entity shows the same view for the start whose tab is open, with no **Can Also Go**.

- ⭕ A ring marks each location where another start begins. The key calls it **Is Here**.
- ➕ With no row selected, click a location to add a start there with no rows. Click a location where starts begin to remove them. The last start can't be removed.

### Entities from older worlds
<!-- keywords: old world, older version, character moved, not where they were, missing npc, used to be everywhere, several locations, now wanders, became generic -->

An older world can list an entity at several locations with no routine. When you open the world, that entity gets one:

| The entity | Gets |
|---|---|
| 🤝 Is listed at every location of the world | **Unique**, starting at the **Player's Starting Location** with **Follows the Player** on. **Can Also Go** is **Anywhere**. |
| 🚶 Has **Pronouns** that don't start with *it*, or the **Persona** mark | **Unique**, starting at its first location, with an **All Day** **Wander** between its locations that waits one daypart. **Can Also Go** lists those locations, or is **Anywhere** if it could follow the player. |
| 👥 Has neither, or has *it/its*, in a world where some entity has **Pronouns** or a **Persona** mark | **Generic**, with a start at each of its locations and no rows. |

In a world where no entity has **Pronouns** or a **Persona** mark, every such entity gets the **Wander**.

⚠️ A **Unique** entity is in **one location at a time**, so it isn't always where the player looks. To keep it in one place, open its **Routine** tab and give it a **Stay** row, or switch it to **Generic**.

## What reaches the AI
<!-- keywords: npc secret, hidden motive, character ignored, npc never appears, spoilers, does ai see image, private notes -->

An entity reaches the AI through a location: one of its own **Locations**, or a location whose **Known Here** list holds it. A relationship with the persona or with an entity in the scene also brings it in. An entity with none of these never reaches the AI.

| Field | Sent? |
|---|---|
| **Name** | Always |
| **Aliases** | Yes, as "also known as" |
| **Pronouns** | Yes, beside the name and aliases |
| **AI-Facing Description** | Yes. This is the main text the AI uses. |
| **AI-Facing Summary** | Only in prompt slots that ask for the short form |
| **Type** | Yes, as a plain field |
| **Stranger Name** | Yes, as a field, until the player meets the entity |
| **Relationships** | Yes, one relationship line each |
| The entity's active traits | Yes, after its description. See [Entity Traits](World-Editor-Traits#entity-traits). |
| **Player-Facing Description** | Only with scene images on, when **Image Tags** and the **AI-Facing Description** are both blank: the AI turns it into image tags |
| **Image Tags** | Not to the text AI. Sent to the image generator for [scene images](Image-Generation#scene-images). |
| Image, 3D model, group, order | Never |
| The **Persona** control | Not as a field. It lets the player play as the entity. See [Personas for Authors](Persona-Authoring#how-to-make-an-entity-playable). |

> 💡 **The player reads only the Player-Facing Description, and the AI reads only the AI-Facing fields.** Put a secret in the **AI-Facing Description**. The narrator can act on it, and the player doesn't see it. The default prompt also asks the narrator not to use a name until the player can know it. That is a request to the AI, and the game doesn't enforce it.

## Descriptions and summaries
<!-- keywords: bio, backstory, personality, appearance, short version, auto generate text, sparkle button, condensed -->
<!-- route: worldEditorEntity.descriptions -->

| Field | Who reads it | Notes |
|---|---|---|
| **Player-Facing Description** | The player, on the entity's card | Never sent to the AI, so it uses no context |
| **AI-Facing Description** | The AI | The full text. Put secrets here. |
| **AI-Facing Summary** | The AI | **Advanced mode only.** One line, for slots where the full text is too long. A blank summary is fine, and the game uses the full description in its place. |

The default narration prompt uses full descriptions for entities at the player's current location and its sub-locations. It uses summaries for entities in *reachable* locations and in **Known Here**. The default prompts of the other steps, such as the choice writer, use summaries for every entity. So write a summary for any entity that matters beyond the narrator's scene.

**Generate summary** beside **AI-Facing Summary** writes a draft from your AI-Facing Description. It is a ✨ icon button, and its tooltip reads "Generate summary from the description". **Generate player-facing description** and **Generate AI-facing description**, ✨ icon buttons beside the two descriptions, draft each one from the other.

## Names and aliases
<!-- keywords: nickname, aka, other names, surname, not detected, wrong npc joins, false match, capitalization, name recognition -->

The game reads each page of narration to find which entities are present. It matches names and aliases.

**A name** matches this way:

| Name | Matches |
|---|---|
| One word, such as `Rose` | Only with a capital first letter. "She rose early" doesn't match. |
| Several words, such as `Emily Foster` | The words in order. One distinctive word with a capital also matches, so "Emily" is enough. A common word alone doesn't match, unless every word of the name is common, such as `Rose Wolf`. |
| Plurals | `Wolf` also matches "Wolves" |

**Aliases** are other names the entity uses: a title, a nickname, an epithet.

- Press Enter after each alias.
- The **Aliases** field shows in Advanced mode only, but aliases work in both modes.
- The AI reads them as *"also known as"*. It reads every alias of an entity in the scene, so give an entity the one or two names the narration uses.
- The game counts the entity as present when the narration uses an alias.

| Rule | Example |
|---|---|
| **Case-sensitive** | `Matron` matches "the Matron" and doesn't match "the matron". Add each form the narration can write. |
| **Plurals match** | `wolf` also matches "wolves" |
| **Whole words only** | `Em` doesn't match inside "System" |

> ⚠️ **Never start an alias with "the".** Narration often puts a title at the start of a sentence, and "The alpha…" doesn't match the alias `the alpha`. Write `alpha`, which matches in both positions.

Two more rules:

- **Don't use general job titles.** `knight`, `alchemist` or `apprentice` match every person of that trade, and the wrong entity joins the scene.
- **Don't use a role the story gives to someone absent.** Quoted dialogue is ignored, but plain narration isn't. If the prose says *"she was sent by the Warchief"*, the alias `Warchief` marks the Warchief as present.

## Strangers
<!-- keywords: stranger name, stranger description, hidden identity, unknown npc, meet, met, start met, hooded figure, known in, introduction -->
<!-- route: worldEditorEntity.profile -->

A stranger is an entity the player hasn't met. Give an entity a **Stranger Name**, a **Stranger Description**, or both. Both fields are in Advanced mode, in the World Editor only, and take placeholders and rolls.

### Stranger Name

The name the player sees until they meet the entity, such as "a hooded figure". It sits beside **Name** on the **Profile** tab, and stacks under it when the panel is narrow. The AI narrator uses the Stranger Name too.

- Leave it blank to show the Name.
- Clearing it never clears the Stranger Description.

**Before the player meets the entity:**

- If the AI tracks the entity under another name, such as "the tall woman", the player sees that name instead.
- The Map doesn't show an entity with a Stranger Name. The Help window shows it only under that other name, with no description.

**The story's use of the Stranger Name brings the entity into the scene.** When the narration writes the whole Stranger Name, such as "a hooded woman" or "the hooded woman", the entity takes part in the turn, as it does for its Name or an alias. One word of it never counts on its own, and a Stranger Name inside quoted dialogue doesn't count.

### Stranger Description

The description the player reads until they meet the entity. It sits directly under **Player-Facing Description** on the **Descriptions** tab. It works alone: with no Stranger Name, the player knows the **Name** but reads this description until they meet the entity.

- The entity's popup in the **Entities** tab shows it in place of the **Player-Facing Description**. The Help window shows it too, for an entity with no Stranger Name.
- Leave it blank to show no description until the player meets the entity.
- The AI narrator sees nothing new.
- A script reads [`met`](Scripts-Reference#meeting-entities) as false for the entity until the player meets it.

**How the player meets the entity.** Once met, the player sees the Name and the Player-Facing Description for the rest of the game.

- The narration uses the entity's Name, or a distinctive part of it such as a first name, while the entity is at the player's location. Dialogue counts. Entries in **Aliases** don't.
- A script calls [`meet()`](Scripts-Reference#meeting-entities) on the entity.

**Entities the player has already met.** The player has met an entity from the start when it has no Stranger Name and no Stranger Description, or when either of these is true:

- It has a relationship with the persona, in either direction.
- One of its **Known In** picks is one of the persona's **Locations**, or contains one. The **Nearby** default doesn't count.

## Locations
<!-- keywords: where npc lives, assign to place, put in room, vanished after delete, several places, too many npcs, crowded scene, orphaned -->

Each entity stores its own locations in one field. The location's **Entities** picker shows the same link from the other side. Set it from either side.

> ⚠️ **When you delete a location, each entity that was there loses it, and nothing warns you.** The entities stay. But an entity that was only in that location is now in no location, so it reaches the AI only through **Known Here** or a relationship. The entity still looks fine on its own tab.

The default prompt sends entities from four places, as separate blocks: the player's **current location**, its **sub-locations**, **reachable** locations, and **Known Here**. The sub-location and reachable blocks list only entities whose **Known In** is **Nearby**.

> ⚠️ **Each entity at the player's location is sent on every turn.** A crowded location uses context all the time. Two or three entities that matter to the scene are better than a full village.

## Relationships
<!-- keywords: family, mother, son, rival, friend, which way, wrong direction, backwards, relationship line -->

Each row on the **Profile** tab says what another entity is to the one you're editing.

**Example:** you're editing *Mara*, and *Tom* is her son.

1. On Mara's **Profile** tab, pick **Tom** in **Add a relationship**.
2. In the box beside **Tom**, type *son*.

**How the AI reads a row**

| Name in the row | | Entity you're editing | Role you type |
|---|---|---|---|
| Tom | is | Mara's | son |

- 🧑 **Persona** — the row says what the player's character is to this entity.
- 🔁 **One row per pair** — you don't need a second row on Tom for Mara. If both exist, the AI reads only one of them, so make sure they agree.

## Entity Stats
<!-- keywords: npc stat, ally health, trust stat, give an entity a stat, entity owns stats, stats tab on entity -->
<!-- route: worldEditorEntity.stats -->

**Advanced mode only.** The **Stats** tab holds the stats this entity owns. It works like the world's [Stats](World-Editor-Stats) tab: the same search box, the same **+** menu, and every field a global stat has.

1. Select the entity and open its **Stats** tab.
2. Click **+**, then **Add Stat**. Text in the search box names the new stat.
3. Select the stat to edit it. The panel is the same one the **Stats** tab uses.

The stats stay on the entity, in the order you set. Dragging a stat reorders it inside this entity only.

### Entity nodes on the Stats tab
<!-- keywords: move stat to npc, move stat between entities, entity in stat group, drag stat to character, why can't i move this stat -->

Each entity with stats shows as a node in the world's **Stats** tab, below the global stats. The **Custom Persona** entity's node shows in Advanced mode even with no stats.

- **Drag the node** into one of your stat groups to place it there. It can't go in **Blueprints**.
- **Drag a stat or a group** onto another entity's node, or out to the global stats, to move it. It keeps its id.
- **Drag a Blueprint stat** onto a node to link it, in Advanced mode. The Blueprint stays where it is.

> ⚠️ **A move is refused when something ties the stat to where it is now.** A note names what ties it:
>
> - A trait that changes the stat, or switches it on or off
> - A script that reads the stat
> - The stat's own code, when it reads another stat
>
> A move is also refused when the other side already has the stat. The same check stops a stat from moving into **Blueprints**. A Blueprint stat that an owner links to stays in **Blueprints**, and the Custom Persona's node can't go in a group.

### What the AI sees
<!-- keywords: ai sees entity stats, npc stats in prompt, send stats to ai, turn off entity stats, hidden stat ai -->

The **Entities** chip lists each entity's stats under its entry. Each stat shows its range, its [Descriptor](World-Editor-Stats#stat-descriptors) and its **Description**.

- **Stats are on for the Here and In Scene scopes.** They are off for **In Sub** and **Reachable**. Check **Stats** under **Include** in [Chip Options](Prompt-Chips#chip-options) to send them there. **Name** content sends names only.
- **Hidden stats are sent.** **Hidden** hides a stat from the player, and the AI still reads it.
- **A stat that is switched off isn't sent.**
- **Clear Include → Stats to leave them out.**
- **Stat Detail picks which parts of each stat the AI reads:** **Range**, **Descriptor** and **Description**. At least one stays checked.
- **Only With keeps the entities that own stats or traits.** To send only entities with stats, check **Stats** under **Only With**. See [How to Send Only Entities With Stats](Prompt-Chips#how-to-send-only-entities-with-stats).

## Openings

An entity can have its own openings, so it can start the scene in its own voice. A playable entity can also have [Self Openings](World-Editor-Openings#self-openings), which start the game for a player who plays it. See [Entity Openings](World-Editor-Openings#entity-openings).

## Groups
<!-- keywords: folder for npcs, organize characters, sort cast, faction folders, nest folders -->

**Advanced mode only.** In Advanced mode, the **+** button's menu also has **Add Group**. Groups are folders for you. Nesting and order are for the editor only and **never reach the AI**. A group can't change the story.

## Images and models
<!-- keywords: portrait, character art, sprite, danbooru, stable diffusion prompt, mesh, face picture, png metadata -->
<!-- route: imageReplace -->

- The image and the 3D model are for the player's screen.
- **Image Tags** are booru tags for AI [image generation](Image-Generation#scene-images) only.
- **Generate image tags**, a ✨ icon button, writes a draft of the tags from the description. Its tooltip reads "Generate image tags from the description".
- A primary image can have a prompt in its file. In Advanced mode, the editor offers to use that prompt when you upload it.

The narrator reads none of these.

An image field takes an uploaded file or a web address. See [Upload or link](World-Editor-Overview#upload-or-link).

An entity's gallery has no slot limit, so a generated image always gets a new slot. A one-image field that already holds an image, such as an item's image, asks **Replace which image?** first. **Cancel** changes nothing.

## Visibility rules
<!-- keywords: show image when hurt, wounded portrait, portrait only when injured, image changes with health, hide image, change image in game, art follows story, transformation art, armored portrait, conditional image, image per state, stat threshold image, form change image -->
<!-- route: worldEditorEntity.profile -->

A **Visibility rule** makes an image show only in the right state. Give the wounded portrait a rule that reads *Health < 20%*, and it shows while the entity is hurt.

- An image with no rule always shows.
- During a game, the entity shows the **first image that is visible**, counting from the left.
- An entity with an Avatar or a 3D model shows that first, unless the player picks another default view. Its image is then behind the **View Image** button.

The rule uses the same [requirement rows](World-Editor-Traits#requirements) as a trait's **Requires** field, including [stat conditions](World-Editor-Traits#stat-conditions) and [time conditions](World-Editor-Traits#time-conditions). Give a night portrait the rule *night*, and it shows only at night.

### How to add a rule
<!-- keywords: cog on thumbnail, add visibility rule, edit rule, shown while, badge on image, eye badge -->

1. Select the entity, then open its **Profile** tab.
2. Hover over the image's thumbnail, then select the cog on its corner. Its tooltip reads **Visibility Rule**. On a touch screen, the cog always shows.
3. Select **Add Requirement**, then pick a trait, a stat, **Time of Day**, or a persona under **Playing As**.
4. Select **And** to add a condition to the same row. Select **Or Another Way** to add a row.

An image shows while **any one row** holds. A row holds when **all** its conditions hold.

A thumbnail with a rule carries an eye badge. The line under the selected thumbnail reads the rule: *Shown while Health < 20% and not Healed*.

A condition checks the entity that owns the image, unless you pick another owner. To read the traits or stats of the entity the player plays, pick **Persona**. A global trait or stat needs no owner. *Shown while Persona: Night Vision* shows the true form to a player who has Night Vision.

### Order sets priority

Put the special states first and the fallback last. For a rule on each of *Wounded* and *Armored*, and none on *Plain*:

| Place | Image | Rule | Shows |
|---|---|---|---|
| 1 | Wounded | *Health < 20%* | While Health is under 20% |
| 2 | Armored | *Knight and Persona: Trusted Ally* | While both hold, and Wounded doesn't |
| 3 | Plain | None | The rest of the time |

- Drag a thumbnail to reorder. The rule goes with its image.
- When you replace an image, the new image keeps the rule.
- When you delete an image, its rule goes too.

### The primary image

The first image is the **primary**. Outside play, the primary always shows and rules are ignored: in the library, on listings, on a character card and in setup.

During a game, the first visible image takes its place. The editor warns when the primary has a rule, so leave it without one and use it as the fallback.

### What the player sees

- The entity panel, the zoom view and the persona row show the same visible image. Each updates when a turn commits.
- Paging skips hidden images.
- A player stays on the image they paged to while it stays visible. When it hides, the view moves to the first visible image, and returns when the rule holds again.
- An image whose trait or stat is gone never shows.
- When every image hides, the entity shows its Avatar or 3D model if it has one. Otherwise it shows no image.
- The player's view follows the turn on screen, so paging back through history shows the images from that turn.

> 💡 **A rule only shows or hides.** There's no *hide when* direction. To hide an image while *Werewolf* is on, give it the rule *not Werewolf*.

> 💡 **Never hide every image.** Keep one image with no rule, or two images with opposite conditions, such as *Health < 20%* and *Health >= 20%*. The [Test Bench](World-Editor-Traits#test-bench-checks) warns when an entity can end up with none.

The narrator never sees the images or their rules.

> 💡 **Locations have rules too.** A location's background images take the same rules. There, a condition with no owner reads the persona. See [Background Visibility rules](World-Editor-Locations#background-visibility-rules).

## SillyTavern cards
<!-- keywords: field mapping, what converts, card fields, alternate greetings, example dialogue, v2 spec, user tag, char tag -->

Import a SillyTavern PNG or JSON card, and it becomes an entity. The card's description, personality and scenario become the **AI-Facing Description**. Its creator becomes the **Author** and its tags the **Tags**. Example dialogue, creator notes, the system prompt and post-history instructions don't come in. The card's greetings become [Entity Openings](World-Editor-Openings#entity-openings):

| On the card | Becomes |
|---|---|
| **First message** | The entity's first Opening Narration |
| Each **alternate greeting** | One more Opening Narration, in card order, at weight 1 |
| The name macro, `{{char}}` | The **Entity Name** chip, in the entity's description and openings. In the card's lorebook, the entity's name as plain text. |
| The user macro, `{{user}}` | The [Persona Name chip](Persona-Authoring#the-persona-name-chip) |

When these openings are in the draw, **Regenerate Narration** on page one shows another greeting, like a swipe in SillyTavern. A card with no first message and no alternate greetings imports with no openings.

> 💡 **The Entity Name chip shows the entity's name, and it follows a rename.** Rename the entity, and its description and openings use the new name.

> 💡 **`{{user}}` stays in the stored text, as the Persona Name chip.** The shown page says the persona's name, or "you" with no persona. The entity's descriptions and the card's lorebook keep the chip too, and there it reads "the player" with no persona.

## In the library
<!-- keywords: standalone character, edit outside world, reusable npc, my characters list, saved character editor, credit and labels, library character stats -->
<!-- route: entityEditor -->

Open an entity in the library's **Entities** tab, and its editor has four tabs.

| Tab | What it holds |
|---|---|
| **Entity** | **Author** and **Tags** in a column on the left. On the right, the **Profile**, **Descriptions** and **Openings** tabs, with the World Editor's fields except **Locations**, **Relationships** and the stranger fields. Its **Avatar** dropdown lists your Avatar library. |
| **Traits** | The entity's own [traits](World-Editor-Traits#entity-traits), across the full width. |
| **Stats** | The entity's own [stats](#entity-stats), across the full width. The stats, groups and links save with the entity's card. A link brings nothing until the world you add the entity to has its Blueprint. |
| **Placeholders** | The entity's own [placeholders](World-Editor-Placeholders), across the full width. |

The editor opens on **Entity** at **Profile**. The author and tags stay in view on all three of its tabs. On mobile, they show at the top of **Profile** only.

The library editor has no Simple or Advanced mode, so it always shows every tab and field it has. It has no **Items** tab. Its **Persona** control has two choices, **Cast** and **Playable**.
