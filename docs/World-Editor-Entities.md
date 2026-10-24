# 🎭 World Editor: Entities
<!-- keywords: characters, npcs, monsters, companions, cast list, items objects, bots -->
<!-- route: worldEditor.entities -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Entities are the people, creatures and things in your world: a ferryman, an eel-smoker, a barred door. An entity belongs to one or more **Locations**. The AI reads the entities that can show up where the player is.

## Why it exists
<!-- keywords: ai forgets characters, narrator invents people, recurring character, persistent npc, keeps renaming -->

Without entities, the narrator invents a stranger, names them, and forgets both by the next turn. An entity is a fixed person or thing the story can come back to. The AI reads about it again each time the player is at one of its locations.

The default prompt lists the entities that **may** appear in the current location. That wording is a hint to the AI. The game doesn't enforce it, and the narrator can use anyone on the list. You can change the wording in the [prompt editor](Prompts#how-to-edit-a-prompt).

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
4. The card joins your library as an entity. The card image becomes the entity's image. Its lorebook, if it has one, joins your library as a dictionary.
5. In the World Editor, open the **Entities** tab, select the **+** button, then select **Add From Library…**.
6. Select the entity, then select **Add Entity** in the window.

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

The world's **Openings** checkbox turns on by itself once an opening has text, unless you unchecked it. See [Entity Openings](World-Editor-Openings#entity-openings).

## The panel
<!-- keywords: pronouns, gender, profile tab, cast or playable, category, can player be them, six tabs -->
<!-- route: worldEditorEntity.profile -->

Select an entity to open its panel.

| Tab | Holds | Mode |
|---|---|---|
| **Profile** | **Name**, **Pronouns**, **Locations** and the **Image**. In Advanced mode, also **Aliases**, the **Persona** control, **Type**, **Image Tags**, the **3D Model** and the **Avatar** dropdown (**None**, **User's Default**, or an Avatar of the world; see [World Avatars](Avatars#world-avatars)). | Simple and Advanced |
| **Descriptions** | **Player-Facing Description** and **AI-Facing Description**. In Advanced mode, also **AI-Facing Summary**. | Simple and Advanced |
| **Traits** | The entity's own [traits](World-Editor-Traits#entity-traits) | Advanced only |
| **Stats** | The entity's own [stats](#entity-stats) | Advanced only |
| **Placeholders** | The entity's own [placeholders](World-Editor-Placeholders#placeholders-that-belong-to-an-entity-or-a-dictionary) | Advanced only |
| **Openings** | The entity's own openings, including Self openings for a playable entity | Advanced only |

The **Persona** control has four choices: **Cast**, **Playable**, **Persona-Only** and **Custom Persona**. It decides whether the player can play as the entity. See [Personas for Authors](Persona-Authoring#how-to-make-an-entity-playable). For an entity marked **Playable** or **Persona-Only**, its **Locations** are also where the player can start as it.

## What reaches the AI
<!-- keywords: npc secret, hidden motive, character ignored, npc never appears, spoilers, does ai see image, private notes -->

An entity reaches the AI only through a location. An entity in no location never reaches the AI.

| Field | Sent? |
|---|---|
| **Name** | Always |
| **Aliases** | Yes, as "also known as" |
| **Pronouns** | Yes, beside the name and aliases |
| **AI-Facing Description** | Yes. This is the main text the AI uses. |
| **AI-Facing Summary** | Only in prompt slots that ask for the short form |
| **Type** | Yes, as a plain field |
| The entity's active traits | Yes, after its description. See [Entity Traits](World-Editor-Traits#entity-traits). |
| **Player-Facing Description** | **Never** |
| Image, Image Tags, 3D model, group, order | Never |
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

The default prompt uses summaries for entities in *reachable* locations. It uses full descriptions for entities at the player's current location. So add a summary only when the entity shows up in reachable locations.

The **✨ toolbar** beside **AI-Facing Summary** can write a draft from your AI-Facing Description.

## Names and aliases
<!-- keywords: nickname, aka, other names, surname, not detected, wrong npc joins, false match, capitalization, name recognition -->

The game reads each page of narration to find which entities are present. It matches names and aliases.

**A name** matches this way:

| Name | Matches |
|---|---|
| One word, such as `Rose` | Only with a capital first letter. "She rose early" doesn't match. |
| Several words, such as `Emily Foster` | The words in order. One distinctive word with a capital also matches, so "Emily" is enough. A common word alone doesn't match. |
| Plurals | `Wolf` also matches "Wolves" |

**Aliases** are other names the entity uses: a title, a nickname, an epithet. Press Enter after each alias. The **Aliases** field shows in Advanced mode only, but aliases work in both modes. The AI reads them as *"also known as"*. The game also counts the entity as present when the narration uses an alias.

| Rule | Example |
|---|---|
| **Case-sensitive** | `Matron` matches "the Matron" and doesn't match "the matron". Add each form the narration can write. |
| **Plurals match** | `wolf` also matches "wolves" |
| **Whole words only** | `Em` doesn't match inside "System" |

> ⚠️ **Never start an alias with "the".** Narration often puts a title at the start of a sentence, and "The alpha…" doesn't match the alias `the alpha`. Write `alpha`, which matches in both positions.

Two more rules:

- **Don't use general job titles.** `knight`, `alchemist` or `apprentice` match every person of that trade, and the wrong entity joins the scene.
- **Don't use a role the story gives to someone absent.** Quoted dialogue is ignored, but plain narration isn't. If the prose says *"she was sent by the Warchief"*, the alias `Warchief` marks the Warchief as present.

## Locations
<!-- keywords: where npc lives, assign to place, put in room, vanished after delete, several places, too many npcs, crowded scene, orphaned -->

Each entity stores its own locations in one field. The location's **Entities** picker shows the same link from the other side. Set it from either side.

> ⚠️ **When you delete a location, each entity that was there loses it, and nothing warns you.** The entities stay. But an entity that was only in that location is now in no location, so it never reaches the AI again. The entity still looks fine on its own tab.

The default prompt sends entities from three places, as separate blocks: the player's **current location**, its **sub-locations**, and **reachable** locations.

> ⚠️ **Each entity at the player's location is sent on every turn.** A crowded location uses context all the time. Two or three entities that matter to the scene are better than a full village.

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

Each entity with stats shows as a node in the world's **Stats** tab, below the global stats.

- **Drag the node** into one of your stat groups to place it there. It can't go in **Blueprints**.
- **Drag a stat or a group** onto another entity's node, or out to the global stats, to move it. It keeps its id.
- **Drag a Blueprint stat** onto a node to link it, in Advanced mode. The Blueprint stays where it is.

> ⚠️ **A move is refused when something reads the stat where it is now.** That is a trait that changes it, or a script that reads it by name. A note names it. A move is also refused when the other side already has the stat. The same check stops a stat from moving into **Blueprints**.

### What the AI sees
<!-- keywords: ai sees entity stats, npc stats in prompt, send stats to ai, turn off entity stats, hidden stat ai -->

The **Entities** chip lists each entity's stats under its entry. Each stat shows its range, its [Descriptor](World-Editor-Stats#stat-descriptors) and its **Description**.

- **Stats are on for the Here and In Scene scopes.** They are off for **In Sub** and **Reachable**. Check **Stats** under **Include** in [Chip Options](Prompts#chip-options) to send them there. **Name** content sends names only.
- **Hidden stats are sent.** **Hidden** hides a stat from the player, and the AI still reads it.
- **A stat that is switched off isn't sent.**
- **Clear Include → Stats to leave them out.**
- **Stat Detail picks which parts of each stat the AI reads:** **Range**, **Descriptor** and **Description**. At least one stays checked.
- **Only With keeps the entities that own stats or traits.** To send only entities with stats, check **Stats** under **Only With**. See [How to Send Only Entities With Stats](Prompts#how-to-send-only-entities-with-stats).

## Openings

An entity can have its own openings, so it can start the scene in its own voice. A playable entity can also have [Self Openings](World-Editor-Openings#self-openings), which start the game for a player who plays it. See [Entity Openings](World-Editor-Openings#entity-openings).

## Groups
<!-- keywords: folder for npcs, organize characters, sort cast, faction folders, nest folders -->

**Advanced mode only.** In Advanced mode, the **+** button's menu also has **Add Group**. Groups are folders for you. Nesting and order are for the editor only and **never reach the AI**. A group can't change the story.

## Images and models
<!-- keywords: portrait, character art, sprite, danbooru, stable diffusion prompt, mesh, face picture, png metadata -->
<!-- route: imageReplace -->

The image and the 3D model are for the player's screen. **Image Tags** are booru tags for AI [image generation](Image-Generation#scene-images) only. The ✨ toolbar can write a draft of the tags from the description. When you upload an image that has a prompt in its file, the editor offers to use that prompt. The narrator reads none of this.

An image field takes an uploaded file or a web address. See [Upload or link](World-Editor-Overview#upload-or-link).

A generated image goes into the first free slot. With no free slot, **Replace which image?** asks which image it takes the place of. **Cancel** changes nothing.

## Visibility rules
<!-- keywords: show image when hurt, wounded portrait, portrait only when injured, image changes with health, hide image, change image in game, art follows story, transformation art, armored portrait, conditional image, image per state, stat threshold image, form change image -->
<!-- route: worldEditorEntity.profile -->

A **Visibility rule** makes an image show only in the right state. Give the wounded portrait a rule that reads *Health < 20%*, and it shows while the entity is hurt.

An image with no rule always shows. In play, the entity shows the **first image that is visible**, counting from the left. The rule uses the same [requirement rows](World-Editor-Traits#requirements) as a trait's **Requires** field, including [stat conditions](World-Editor-Traits#stat-conditions) and [time conditions](World-Editor-Traits#time-conditions). Give a night portrait the rule *night*, and it shows only at night.

### How to add a rule
<!-- keywords: cog on thumbnail, add visibility rule, edit rule, shown while, badge on image, eye badge -->

1. Select the entity, then open its **Profile** tab.
2. Hover over the image's thumbnail, then select the cog on its corner. Its tooltip reads **Visibility Rule**. On a touch screen, the cog always shows.
3. Select **Add Requirement**, then pick a trait, a stat or **Time of Day**.
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

In play, the first visible image takes its place. The editor warns when the primary has a rule, so leave it without one and use it as the fallback.

### What the player sees

- The entity panel, the zoom view and the persona row show the same visible image. Each updates when a turn commits.
- Paging skips hidden images.
- A player stays on the image they paged to while it stays visible. When it hides, the view moves to the first visible image, and returns when the rule holds again.
- An image whose trait or stat is gone never shows.
- When every image hides, the entity shows its 3D model if it has one. Otherwise it shows no image.
- The player's view follows the turn on screen, so paging back through history shows the images from that turn.

> 💡 **A rule only shows or hides.** There's no *hide when* direction. To hide an image while *Werewolf* is on, give it the rule *not Werewolf*.

> 💡 **Never hide every image.** Keep one image with no rule, or two images with opposite conditions, such as *Health < 20%* and *Health >= 20%*. The [Test Bench](World-Editor-Traits#test-bench-checks) warns when an entity can end up with none.

The narrator never sees the images or their rules.

> 💡 **Locations have rules too.** A location's background images take the same rules. There, a condition with no owner reads the persona. See [Background Visibility rules](World-Editor-Locations#background-visibility-rules).

## SillyTavern cards
<!-- keywords: field mapping, what converts, card fields, alternate greetings, example dialogue, v2 spec, user tag, char tag -->

Import a SillyTavern PNG or JSON card, and it becomes an entity. The card's description, personality and scenario become the **AI-Facing Description**. The card's greetings become [Entity Openings](World-Editor-Openings#entity-openings):

| On the card | Becomes |
|---|---|
| **First message** | The entity's first Opening Narration |
| Each **alternate greeting** | One more Opening Narration, in card order, at weight 1 |
| The name macro, `{{char}}` | The **Character Name** chip, in the entity's description and openings. In the card's lorebook, the entity's name as plain text. |
| The user macro, `{{user}}` | The [Persona Name chip](Persona-Authoring#the-persona-name-chip) |

When these openings are in the draw, **Re-generate** on page one shows another greeting, like a swipe in SillyTavern. A card with no first message and no alternate greetings imports with no openings.

> 💡 **The Character Name chip shows the entity's name, and it follows a rename.** Rename the entity, and its description and openings use the new name.

> 💡 **`{{user}}` stays in the stored text, as the Persona Name chip.** The shown page says the persona's name, or "you" with no persona. The entity's descriptions and the card's lorebook keep the chip too, and there it reads "the player" with no persona.

## In the library
<!-- keywords: standalone character, edit outside world, reusable npc, my characters list, saved character editor, credit and labels, library character stats -->
<!-- route: entityEditor -->

Open an entity in the library's **Entities** tab, and its editor has four tabs.

| Tab | What it holds |
|---|---|
| **Entity** | **Author** and **Tags** in a column on the left. On the right, the **Profile**, **Descriptions** and **Openings** tabs, with the same fields as the World Editor. |
| **Traits** | The entity's own [traits](World-Editor-Traits#entity-traits), across the full width. |
| **Stats** | The entity's own [stats](#entity-stats), across the full width. The stats, groups and links save with the entity's card. A link brings nothing until the world you add the entity to has its Blueprint. |
| **Placeholders** | The entity's own [placeholders](World-Editor-Placeholders), across the full width. |

The editor opens on **Entity** at **Profile**. The author and tags stay in view on all three of its tabs. On mobile, they show at the top of **Profile** only.

The library editor has no Simple or Advanced mode, so it always shows every tab and field. Its **Persona** control has two choices, **Cast** and **Playable**.
