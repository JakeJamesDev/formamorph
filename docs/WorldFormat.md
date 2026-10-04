# 📐 World Format
<!-- keywords: file spec, modding, write a tool, generator script, data layout, export contents, documentation for developers -->

This page describes the `.json` file of a Formamorph **world**: the file **Export World** writes and **Import World** reads. Use it when you edit a world file by hand or write a tool for one.

> 💡 The **World Editor** writes this format for you. Edit the file by hand only for a change the editor can't make, or for a bulk change.

> 📄 This page covers world files only. It does not describe save files.

## How to Edit a World File by Hand
<!-- keywords: json, text editor, manual, raw, modify, notepad, tweak, fields, vscode, outside the app, bulk change, reimport, duplicate created, wont overwrite, open exported, hack -->
<!-- route: mainMenu.worlds -->

1. In the main menu, select the world. In its [world dialog](Starting-a-Game#the-world-dialog), select **Export World**.
2. Open the `.json` file in a text editor. Make your changes.
3. In the main menu, open the **Worlds** tab and select **Import World**. Pick the file.

> 💡 The World Editor's **Overview** tab has **Export World** too.

The import adds a new world. It never replaces the world you exported. Import skips a file that fails to load, and the menu tells you.

## How to Add a Stat
<!-- keywords: json, file, list, by hand, manual, schema, field, raw object, property names, regen key, meter entry, required keys -->

1. Add an object to the top-level `stats` list.
2. Give it a new `id` and a `name`. Stat code and the AI find a stat by its name, so keep names unique.
3. Set `type` to `"number"`, or to `"percentage"` for a 0–100 stat.
4. Set `min`, `max`, `value` (the **Initial Value**) and `regen`.
5. Write a `description`, and set `descriptors` to `[]` or to a list of [descriptors](#stat-descriptors).

```json
{ "id": "stamina", "name": "Stamina", "type": "number", "description": "Energy for hard work",
  "min": 0, "max": 100, "value": 80, "regen": 2, "descriptors": [] }
```

## How to Add a Trait
<!-- keywords: json, file, list, by hand, manual, schema, field, perk object, statchanges key, groupid, ai text key, unique ids -->

1. Add an object to the top-level `traits` list. For a trait that one entity owns, add it to that entity's `traits` list.
2. Give it a new `id` and a `name`. Trait ids must be unique across the world and every entity.
3. Write `playerDescription` and `aiDescription`.
4. Set `statChanges` to `[]` or to a list of [stat changes](#stat-changes).
5. To put it in a group, set `groupId` to the [group's](#trait-groups) `id`.

```json
{ "id": "strong", "name": "Strong", "playerDescription": "Above-average strength",
  "aiDescription": "This person is unusually strong.", "groupId": "physical",
  "statChanges": [{ "statId": "stamina", "value": 10, "type": "max" }] }
```

## How to Add an Entity
<!-- keywords: json, file, list, by hand, manual, schema, character, npc, aliases key, pronouns key, location ids, playable flag, summary key -->

1. Add an object to the top-level `entities` list.
2. Give it a new `id` and a `name`.
3. Write `playerDescription`, `aiDescription` and, for a long description, `aiSummary`.
4. Set `locations` to the ids of the locations where the entity is. Leave it out for an entity with no fixed place.
5. To make the entity playable, set `persona` to `true`. See [Persona Marks](#persona-marks).

```json
{ "id": "smith", "name": "Mara", "aliases": ["the smith"], "pronouns": "she/her",
  "playerDescription": "The village blacksmith.", "aiDescription": "Mara is a gruff, fair blacksmith.",
  "locations": ["town"] }
```

---

## Reading the Tables
<!-- keywords: req column, checkmark meaning, required vs optional, uuid, legend, editor-only meaning, mandatory -->

| Mark | Meaning |
|---|---|
| ✓ in **Req.** | The world types always carry this field. Write it. |
| No mark | Optional. The description says what an absent field means. |
| `id` | A unique string. The editor writes random UUIDs. Any unique string works. |

**Editor-only** fields organize the World Editor. The AI never reads them.

## The File
<!-- keywords: top level keys, root object, import refused, wont load, invalid file, minimum valid, skeleton, missing sections -->

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `formamorphKind` | | `"world"` | Export writes it. Import does not need it. |
| `version` | | String | The app version that wrote the file, such as `"3.1.2"`. See [Versions and Older Files](#versions-and-older-files) |
| `worldOverview` | ✓ | Object | Name, listing text and world-wide settings. See [worldOverview](#worldoverview) |
| `stats` | ✓ | [Stat](#stats)[] | The player's numbers |
| `locations` | ✓ | [Location](#locations)[] | Places. A location can nest inside another |
| `connections` | | [Connection](#connections)[] | Travel links between locations. Absent = travel follows nesting only |
| `entities` | ✓ | [Entity](#entities)[] | People, creatures and objects |
| `entityGroups` | | [Group](#entity-groups)[] | Editor-only groups for entities |
| `traits` | ✓ | [Trait](#traits)[] | The world's traits |
| `traitGroups` | | [TraitGroup](#trait-groups)[] | Groups for the world's traits |
| `placeholders` | | [Placeholder](#placeholders)[] | The world's shared placeholders |
| `placeholderGroups` | | [Group](#placeholder-groups)[] | Editor-only groups for shared placeholders |
| `dictionaries` | ✓ | [Dictionary](#dictionaries)[] | Lore books. Import makes one empty book when the list is absent or empty |
| `statUpdates` | ✓ | [StatUpdate](#stat-updates)[] | An older field. Write `[]` |

A stored world also has an `id`. Export leaves it out, and import gives the world a new one.

> ⚠️ **Import refuses a world without `worldOverview`, `stats`, `locations`, `entities`, `traits` and `statUpdates`.** An empty list is enough.

## Versions and Older Files
<!-- keywords: backward compatible, legacy, outdated world, upgrade, deprecated keys, renamed properties, compatibility, converted automatically, migration, old version, old file -->

Import runs every world through a migration. The migration changes an older shape into the current one, so a file from any version loads. These older forms still load:

| Older form | Loads as |
|---|---|
| No `version` (before 2.0) | The current shape |
| A flat `dictionary` list | One book named "Default" in `dictionaries` |
| A dictionary `key` or `secondaryKeys` as one comma-separated string | A list of keywords |
| An entity `image` string | The first item of `images` |
| A location `entities` list | Each entity's `locations` |
| A location `connections` list of names | Records in the top-level `connections` |
| A connection with `from`, `to`, `twoWay` and `aiHint` | A connection with `a`, `b` and legs |
| A location `isStartLocation` flag | `isStarting` |
| Placeholder `values` as strings, `weights` keyed by text | Value records, weights keyed by value `id` |
| `worldOverview.openingCue` and `openingCueEnabled` | One Opening Action in `openings`, and `openingsEnabled` |
| `worldOverview.playerSetting` | `allowedPersonas` and `startPersona` |
| A trait group `exclusive: true` | `maxPicks: 1` |
| An entity link to a trait outside Blueprints | Removed, with its overrides |
| A stat with `type: "list"` | A `number` stat at its `min`. The items are dropped |
| Stat code that uses `stats.find(…)` | The same code with the stat map |
| A Stomach, Fatness or Breastsize stat with no `morphBindings` | The matching body morphs |
| A root `customPlayerVRM` | `worldOverview.customPlayerVRM` |
| Entity and location `inGameDescription` and `detailedDescription` | `playerDescription` and `aiDescription` |
| A trait `description` | Both `playerDescription` and `aiDescription` |

> ⚠️ **The last six rows run only when `version` is not the app's version.** A file stamped with the current version keeps those older forms as written.

Write new files in the current shape.

## worldOverview
<!-- keywords: metadata block, title key, system prompt key, music key, welcome markdown, replace narration prompt, creator, tag array, persona restriction keys -->

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `name` | ✓ | String | The world's name |
| `description` | ✓ | String | The **Player-Facing Description**: card and listing text. The AI never reads it |
| `author` | ✓ | String | Free text that names the author |
| `thumbnail` | ✓ | [Image](#media-fields) \| `null` | The card image |
| `bgm` | ✓ | [Audio](#media-fields) \| `null` | Background music, as a data URL |
| `systemPrompt` | ✓ | String | The **AI-Facing Description**: what the AI reads about the world. Players never see it |
| `use3DModel` | ✓ | Boolean | The world shows a 3D avatar |
| `tags` | ✓ | String[] | Listing tags |
| `customPlayerVRM` | | [MediaAsset](#media-fields) \| `null` | The world's own player avatar, a `.vrm` file |
| `readme` | | String | Markdown the player sees when play starts |
| `introReadme` | | String | Markdown the player sees on the first setup screen. It shares the readme's on and off switch |
| `promptOverrides` | | Object | The world's **Custom Prompts**. See below. Absent = the player's prompts |
| `openings` | | [Opening](#openings)[] | The world's own openings, in order |
| `openingWeights` | | Object | Draw weight per opening `id`. A missing entry weighs 1. `0` keeps an opening and never draws it |
| `openingsEnabled` | | Boolean | `false` stops every opening of the world, its locations and its entities from drawing. Absent = on |
| `allowedPersonas` | | `"any"` \| `"world"` | Which personas the player can pick. `"world"` allows only this world's personas and its Custom Persona. Absent = `"any"` |
| `startPersona` | | Object | The persona a new player starts on: `{ "source": "none" }`, or `{ "source": "world", "entityId": "<entity id>" }`. Absent = the player's default persona |

See [Persona Rules](Persona-Authoring#persona-rules) for how the last two fields behave.

**`promptOverrides`** replaces some of the player's prompts while they play this world:

| Field | Type | Meaning |
|---|---|---|
| `systemPrompt` | String | Replaces the narration system prompt |
| `systemPromptEnabled` | Boolean | `false` keeps the text and does not use it. Absent = used |
| `choicesPrompt` | String | Replaces the choices system prompt |
| `choicesPromptEnabled` | Boolean | `false` keeps the text and does not use it |
| `statUpdatesPrompt` | String | Replaces the stat updates system prompt |
| `statUpdatesPromptEnabled` | Boolean | `false` keeps the text and does not use it |

## Stats
<!-- keywords: meter properties, threshold bands, morph bindings, code keys, lock flags, bonus object, percent unit, hidden flag -->

Each stat is a number the player has. The AI reads it, and [stat code](StatCodeGuide) can calculate it.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The name. Stat code and the AI find the stat by it |
| `type` | ✓ | `"number"` \| `"percentage"` | A `percentage` stat has `min` 0 and `max` 100, and shows as `N%`. The AI can't change its max |
| `description` | ✓ | String | What the stat means |
| `min` | ✓ | Number | The lowest value |
| `max` | ✓ | Number | The highest value |
| `value` | | Number | The **Initial Value**: what a new game starts at. Absent or `0` = `min` |
| `starting` | | Number | The value a save gets when it did not have this stat yet. A new game also measures turn one's change from it. Absent = `value`. Keep it equal to `value` |
| `regen` | ✓ | Number | The change per story hour. Negative drains |
| `descriptors` | ✓ | [Descriptor](#stat-descriptors)[] | Text for each band of values |
| `thresholdUnit` | | `"raw"` \| `"percent"` | What a descriptor's `threshold` measures. `"raw"` = the stat's own units. `"percent"` = a percent of `min` to `max`. Absent = `"raw"`. A `percentage` stat is always percent |
| `beforeCode` | | String | Stat code that runs before the AI's turn. Its changes reach that turn's prompt. See the [Stat Code Guide](StatCodeGuide) |
| `code` | | String | Stat code that runs after the AI's changes and regen |
| `morphBindings` | | String[] | Body morph names this stat drives. `min` to `max` maps to 0 to 1 |
| `enabled` | | Boolean | `false` starts the stat off. The player and the AI don't see it, and regen and code stop. A trait's `statToggles` switches it on. Absent = on |
| `hidden` | | Boolean | `true` hides the stat from the player. The AI still reads it, and regen and code still run |
| `noIncrease` / `noDecrease` | | Boolean | The AI can't raise or lower the value |
| `noIncreaseMax` / `noDecreaseMax` | | Boolean | The AI can't raise or lower the max |

### Stat Descriptors

A descriptor gives the AI a word or phrase for a band of values.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String \| Number | Unique id |
| `threshold` | ✓ | Number | The top of the band, in the stat's `thresholdUnit` |
| `description` | ✓ | String | The text the AI reads while the value is in the band |
| `placeholderPins` | | [Pin](#placeholder-pins)[] | Placeholder values pinned while the value is in the band |

The lowest band that holds the value wins, in any list order. A value above every threshold has no descriptor.

### Stat Changes

A trait changes a stat with a list of these.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `statId` | ✓ | String | The stat's `id` |
| `value` | ✓ | Number | The amount to add. Negative subtracts |
| `type` | | `"min"` \| `"max"` \| `"starting"` \| `"regen"` | What the change adds to. `"starting"` adds to the value. Absent = no change |
| `interval` | | String | An older field. Nothing reads it |

## Traits
<!-- keywords: perk properties, prerequisite object, pick limits keys, mode values, default flag, category object, template folder flag, toggle flag -->

A trait describes the player or an entity. The player picks traits before play. An entity can own traits too.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique across the world and every entity |
| `name` | ✓ | String | The name |
| `playerDescription` | | String | What the player reads on the setup screen |
| `aiDescription` | | String | What the AI reads while the trait is active |
| `statChanges` | ✓ | [StatChange](#stat-changes)[] | Changes to the player's stats while the trait is active |
| `groupId` | | String \| `null` | The [group's](#trait-groups) `id`. Absent or `null` = the top level |
| `order` | | Number | The order among items in the same group |
| `isDefault` | | Boolean | The trait starts selected |
| `playerToggle` | | Boolean | The player can switch the trait on and off during play |
| `mode` | | `"alwaysOn"` \| `"hidden"` | Absent = Optional: the player picks. `"alwaysOn"` is active while its requirements hold, and the player can't switch it. `"hidden"` acts as `"alwaysOn"`, and the player never sees it. Both ignore `isDefault` and `playerToggle` |
| `requires` | | [Requirement](#trait-requirements)[] | Any one of these makes the trait available. Absent or empty = always available |
| `statToggles` | | `{ "statId", "enabled" }`[] | Stats switched on or off while the trait is active |
| `placeholderPins` | | [Pin](#placeholder-pins)[] | Placeholder values pinned while the trait is active |

See [World Editor: Traits](World-Editor-Traits) for how modes, requirements and pick counts behave in play.

### Trait Requirements

Each requirement has a `kind`:

| `kind` | Other fields | Holds when |
|---|---|---|
| `"trait"` | `id`, `name`, `bearer` | The bearer has the trait with this `id` |
| `"group"` | `id`, `name`, `bearer` | The bearer has any trait in the group with this `id` |
| `"playingAs"` | `id`, `name` | The player plays as the entity with this `id` |

- `name` is optional. It holds the target's name, so a requirement still reads when the target is gone.
- `bearer` is optional. Absent = the trait's own bearer. `{ "kind": "you" }` checks the player. `{ "kind": "entity", "id": "<entity id>", "name": "…" }` checks that entity.

### Trait Groups

A group holds traits and other groups. Both the world and each entity have a `traitGroups` list.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The heading on the setup screen |
| `playerDescription` | | String | Text the player reads under the heading |
| `aiDescription` | | String | A header the AI reads above the group's active traits |
| `parentId` | ✓ | String \| `null` | The parent group's `id`. `null` = the top level |
| `order` | | Number | The order among items with the same parent |
| `minPicks` | | Number | The fewest traits placed directly in the group that must be active. Absent = 0 |
| `maxPicks` | | Number | The most traits placed directly in the group that can be active. Absent = no limit. `1` shows radio buttons |
| `system` | | `"blueprints"` | Marks the world's [Blueprints](#blueprints) group. Only one world group has it, at the top level |

### Blueprints

The world group with `system: "blueprints"`, and every group below it, holds Blueprints items. The player never picks a Blueprints trait. It reaches play only through an entity's [link](#trait-links). Only a Blueprints trait or group can be linked.

## Locations
<!-- keywords: place properties, parent key, travel link object, two-way legs, spawn flag, backdrop key, map coordinates, hint key -->

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The name |
| `playerDescription` | | String | What the player reads |
| `aiDescription` | | String | The full description the AI reads |
| `aiSummary` | | String | A short description the AI reads where the full one is too long |
| `description` | | String | An older field. The player reads it when `playerDescription` is absent |
| `backgroundImage` | | [Image](#media-fields) | The background |
| `imageTags` | | String | Comma-separated tags for image generation |
| `ambientSound` | | [MediaAsset](#media-fields) | Looping sound |
| `isStarting` | | Boolean | A new game can start here. One marked = every game starts there. Several = the player picks. None = any location. A played entity's `startingLocationId` joins the choices |
| `parentId` | | String \| `null` | The parent location's `id`. Absent or `null` = the top level. List order is the order among siblings |
| `canvasPosition` | | `{ "x", "y" }` | Editor-only. The location's place on the Locations canvas, relative to its parent. Absent = automatic |
| `placeholderPins` | | [Pin](#placeholder-pins)[] | Placeholder values pinned while the player is here. A child location does not get its parent's pins |
| `openings` | | [Opening](#openings)[] | Openings that draw when a game starts at this exact location |
| `openingWeights` | | Object | Draw weight per opening `id`, as in `worldOverview` |

### Connections

A connection is a travel link between two locations. A connection between two locations replaces the travel that nesting gives them. Its legs are then the only travel between the two.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `a` | ✓ | String | One location's `id` |
| `b` | ✓ | String | The other location's `id` |
| `aToB` | | Leg | Present when travel goes from `a` to `b` |
| `bToA` | | Leg | Present when travel goes from `b` to `a` |

A connection needs at least one leg. Both legs = two-way. A leg has one optional field, `hint`: how the trip is made, such as "through the old gate". The AI reads it after the destination's name.

## Entities
<!-- keywords: npc properties, character object, persona marks, nickname list, gallery array, link object keys, card file extras, folder key -->

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The name |
| `aliases` | | String[] | Other names. The AI reads them. The app finds them in the story text, case-sensitive and whole-word |
| `pronouns` | | String | Free text, such as "she/her". The AI reads it |
| `type` | | String | An optional category label |
| `persona` | | Boolean | The **Persona** mark. See [Persona Marks](#persona-marks) |
| `personaOnly` | | Boolean | The entity exists only while the player plays it |
| `customPersona` | | Boolean | The **Custom Persona** mark |
| `startingLocationId` | | String | The **Starting Location** preselected when the player plays this entity. Absent = Automatic: the first of its `locations` marked `isStarting` |
| `playerDescription` | | String | What the player reads |
| `aiDescription` | | String | The full description the AI reads |
| `aiSummary` | | String | A short description the AI reads where the full one is too long |
| `images` | | [Image](#media-fields)[] | The gallery. The first image is the main one |
| `tags` | | String[] | Listing tags for Community Creations |
| `imageTags` | | String | Comma-separated tags for image generation |
| `sound` | | [MediaAsset](#media-fields) | A sound |
| `model` | | [MediaAsset](#media-fields) | A 3D model |
| `locations` | | String[] | The `id`s of the locations where the entity is. It is at all of them |
| `groupId` | | String \| `null` | Editor-only. The [entity group's](#entity-groups) `id`. Absent or `null` = no group |
| `order` | | Number | Editor-only. The order in its group |
| `openings` | | [Opening](#openings)[] | The entity's own openings |
| `openingWeights` | | Object | Draw weight per opening `id`, as in `worldOverview` |
| `placeholders` | | [Placeholder](#placeholders)[] | Placeholders the entity owns, and its [copies](#copies) |
| `traits` | | [Trait](#traits)[] | Traits the entity owns. They describe it to the AI. They are the player's when the player plays it |
| `traitGroups` | | [TraitGroup](#trait-groups)[] | Groups for the entity's own traits |
| `traitLinks` | | [TraitLink](#trait-links)[] | Links to Blueprints traits and groups |
| `traitPlacement` | | `{ "groupId", "order" }` | Where the entity's node sits in the world's Traits tree. `groupId` is a world group `id` or `null` for the top level. Absent = the end of the top level |
| `link` | | [ContentLink](#linked-copies) | What library item this copy follows. Absent = it follows nothing |

Only the player has stats. So `statChanges` and `statToggles` on an entity's own traits apply only on a playable, persona-only or Custom Persona entity. A playable or persona-only entity's apply while the player plays it. The Custom Persona entity's apply while the player has no world persona.

### Persona Marks

The **Persona** control on the entity's **Profile** tab writes three fields:

| Choice | `persona` | `personaOnly` | `customPersona` |
|---|---|---|---|
| **Cast** | absent | absent | absent |
| **Playable** | `true` | absent | absent |
| **Persona-Only** | `true` | `true` | absent |
| **Custom Persona** | absent | absent | `true` |

One entity at most has `customPersona`, at the top level of the Traits tree. In a library entity, `persona: true` makes it one of the player's personas. See [Personas for Authors](Persona-Authoring) for the rules.

### Trait Links

A link gives a [Blueprints](#blueprints) trait or group to an entity. The entity does not get its own trait. The link reads its original live, except for the fields it overrides.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `originalId` | ✓ | String | The `id` of the Blueprints trait or group |
| `kind` | ✓ | `"trait"` \| `"group"` | What the original is |
| `originalName` | ✓ | String | The original's name. When an entity joins a world, its link finds the original by `originalId`, then by this name |
| `groupId` | ✓ | String \| `null` | One of the entity's own group `id`s. `null` = the entity's top level |
| `order` | | Number | The order among the entity's items with the same parent |
| `overrides` | | Object | Overrides per trait. The key is the original trait's `id`. A linked group keys each of its traits here |
| `keyNames` | | Object | Outside a world only, such as in an entity file: trait `id` to name, for each key of `overrides` |

Each override map can hold `isDefault`, `requires`, `placeholderPins`, `playerToggle`, `statChanges` and `mode`. `mode` takes `"optional"`, `"alwaysOn"` or `"hidden"`. Each field holds `{ "value": …, "blueprint": … }`: your value, and the original's value when you set it. The app uses `blueprint` to tell you when the original changed.

An entity links each original one time.

### Entity Groups

Editor-only groups for entities.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The group name |
| `parentId` | ✓ | String \| `null` | The parent group's `id`. `null` = the top level |
| `order` | | Number | The order among groups with the same parent |

### Entity Files

An entity file, or an entity in the library, can also carry these fields. The app clears them when the entity joins a world, so a world file does not need them.

| Field | Type | Meaning |
|---|---|---|
| `sharedPlaceholders` | [Placeholder](#placeholders)[] | The world placeholders the entity's chips use |
| `blueprints` | [Placeholder](#placeholders)[] | The blueprints the entity's copies read |
| `locationRefs` | `{ "id", "name" }`[] | The locations the entity stood in, by name |

## Openings
<!-- keywords: greeting object, first message key, action or narration, self flag, kind values, intro entry -->

An opening is one way a game can start. The world, each location and each entity have an `openings` list.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique within its owner. `openingWeights` uses it as the key |
| `text` | ✓ | String | The text. It can hold [chips](#chips-in-text) |
| `kind` | ✓ | `"action"` \| `"narration"` | `"action"` fills the player's input box. `"narration"` is page one, as written |
| `self` | | `true` | A Self opening. It draws only while the player plays its owner. Only an entity with the Persona or Custom Persona mark can own one. Absent = an Others opening |

See [World Editor: Openings](World-Editor-Openings) for which openings draw.

## Placeholders
<!-- keywords: token syntax, double brace format, write token manually, random list object, weights map, pin object, roll flag, variable properties, override map -->

A placeholder is a named value that a chip shows in text. The world's `placeholders` are shared. An entity's or a book's `placeholders` belong to it.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id. Do not use `:`, `{` or `}` in it |
| `name` | ✓ | String | The name in the editor. Chips use the `id`, so a new name breaks nothing |
| `values` | ✓ | Value[] | The values. See below. Empty = the chip reads as nothing |
| `weights` | | Object | Draw weight per value `id`. A missing entry weighs 1. `0` keeps a value and never draws it |
| `roll` | | Boolean | `true` = a Wildcard, which draws one value per game. `false` = an Object, which joins all values with `", "`. Absent = a Wildcard with two or more values. With one value, the placeholder is a Variable |
| `ownerId` | | String | The placeholder this one belongs to. Absent = the top level |
| `sharedWeights` | | Object | Draw weights this placeholder sets on shared placeholders it reaches through its values. The outer key is a path of `id`s joined with `/`. The inner map is like `weights` |
| `blueprintId` | | String | Makes this a [copy](#copies) of that blueprint |
| `valueOverrides` | | Object | On a copy: changes per blueprint value `id` |
| `groupId` | | String \| `null` | Editor-only. A shared placeholder's [group](#placeholder-groups) `id`. Absent or `null` = no group |

Each value:

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id. Pins and weights use it |
| `text` | ✓ | String | The text. It can hold chips. A value that is exactly one chip makes that placeholder a part of this one |
| `pins` | | [Pin](#placeholder-pins)[] | Placeholder values pinned while this value is the drawn one |

See [World Editor: Placeholders](World-Editor-Placeholders) for kinds, parts and weights.

### Placeholder Pins

A pin sets one placeholder to one value while its source is active. Traits, locations, stat descriptors and placeholder values carry pins.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `placeholderId` | ✓ | String | The placeholder's `id`. On a trait, a blueprint `id` pins each bearer's copy |
| `value` | ✓ | String | The value's text |
| `valueId` | | String | The value's `id`. When present, it wins over `value`, so a reworded value still matches |

### Copies

A world shared placeholder in the [Blueprints group](#placeholder-groups), or a group below it, is a **blueprint**. An entity holds a copy of each blueprint its traits need, in its own `placeholders`, with `blueprintId` set. The app makes copies when it loads the world.

A copy reads its blueprint's values live. Its own `values` hold only the values it adds. Its `valueOverrides` map a blueprint value `id` to changes:

| Field | Type | Meaning |
|---|---|---|
| `text` | `{ "value", "blueprint" }` | Your text for the value, and the blueprint's text when you set it |
| `weight` | `{ "value", "blueprint" }` | Your draw weight, and the blueprint's weight when you set it |
| `removed` | `true` | This copy never draws the value |

### Placeholder Groups

Editor-only groups for the world's shared placeholders.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The group name |
| `parentId` | ✓ | String \| `null` | The parent group's `id`. `null` = the top level |
| `order` | | Number | The order among groups with the same parent |
| `system` | | `"blueprints"` | Marks the Blueprints group. Only one group has it, at the top level |

### Chips in Text

A chip is a token in a text field. The editor inserts chips. To write one by hand, use this form:

```
{{ph:<placeholder id>:<world|unique>:<placement id>}}
```

| Part | Meaning |
|---|---|
| `<placeholder id>` | The placeholder's `id` |
| `world` | Every chip of this placeholder shows the same drawn value in a game |
| `unique` | This chip draws its own value |
| `<placement id>` | A unique id for this chip. A `unique` chip keeps its draw under it |

The editor can add two more parts after the placement id: a path to a part of the placeholder, and a label after `:=`. Copy those from a chip the editor wrote.

Two chips need no placeholder. `{{user}}` is the [Player Name chip](Persona-Authoring#the-player-name-chip). `{{char}}` is the [Character Name chip](Persona-Authoring#the-character-name-chip).

## Dictionaries
<!-- keywords: lorebook object, keyword array, regex flag, constant flag, position values, depth key, world info fields, token budget -->

`dictionaries` is a list of books. Each book holds lore entries. An entry goes into the AI's prompt when one of its keywords is in the scanned text. See [What Gets Scanned](World-Editor-Dictionary#what-gets-scanned).

Each book:

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The book's name |
| `description` | | String | A note for people. The AI never reads it |
| `enabled` | | Boolean | `false` turns off every entry in the book. Absent = on |
| `tags` | | String[] | Listing tags for Community Creations |
| `thumbnail` | | [Image](#media-fields) \| `null` | The listing image |
| `entries` | ✓ | Entry[] | The entries, in order |
| `placeholders` | | [Placeholder](#placeholders)[] | Placeholders the book owns |
| `sharedPlaceholders` | | [Placeholder](#placeholders)[] | In a dictionary file only: the world placeholders its entries use. Import clears it |
| `link` | | [ContentLink](#linked-copies) | What library item this copy follows |

Book order sets the order in the prompt.

### Dictionary Entries

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | A label. Blank = the first keyword |
| `key` | ✓ | String[] | The keywords, one per item |
| `value` | ✓ | String | The text the AI reads when the entry is active |
| `enabled` | | Boolean | `false` turns the entry off. Absent = on |
| `constant` | | Boolean | The entry is always active |
| `secondaryKeys` | | String[] | Second keywords. When present, a keyword match also needs a second keyword |
| `secondaryAll` | | Boolean | Needs all second keywords, not one |
| `secondaryExclude` | | Boolean | Inverts the second test: the entry is active only when the second keywords are absent |
| `useRegex` | | Boolean | Keywords are regular expressions |
| `matchWholeWords` | | Boolean | Keywords match whole words only. Ignored with `useRegex` |
| `caseSensitive` | | Boolean | Keywords match case. Absent = any case |
| `recursive` | | Boolean | Text from other active entries can activate this entry |
| `position` | | `"before"` \| `"after"` | `"before"` = Background Lore, early in the prompt. `"after"` = Foreground Lore, late. Absent = `"after"` |
| `scanDepth` | | Number | Scan only the last N messages. The app always scans the current scene. Absent = all |
| `priority` | | Number | Kept from an imported lorebook for export. The app does not use it |
| `tokenBudget` | | Number | Kept from an imported lorebook for export. The app does not use it |
| `extensions` | | Object | Other imported lorebook fields, kept for export |

## Linked Copies
<!-- keywords: link object, library id, revision keys, source tracking, sync metadata, bundled from -->

An entity or a book in a world can follow a library item. Its `link` object records that. Let the app write it. See [Linked Content](LinkedContent).

| Field | Type | Meaning |
|---|---|---|
| `libraryId` | String | The library item's `id` |
| `sourceId` | String | The published listing behind the library item |
| `sourceRevision` | String | The source revision this copy holds |
| `reviewedRevision` | String | The last revision the author reviewed |
| `localReplacement` | Boolean | The copy was edited and still follows its source |
| `sourceName` | String | The source's name, for display |
| `connections` | Object | What each world placeholder or location the source expects is in this world, by `id` |
| `bundledFrom` | String | The copy came in an imported world file, and its library item is not on this machine |

## Stat Updates
<!-- keywords: deprecated list, unused, empty array, obsolete, leftover, what is this for -->

`statUpdates` is an older list. No screen edits it, and play does not read it. Write `[]`. An older file can hold records with `id`, `name`, `prompt`, `stats` (stat names) and `messageHistory`.

## Media Fields
<!-- keywords: base64, embed binary, encode image, huge file size, web address string, audio encoding, mime, asset object -->

**Images** (`thumbnail`, location `backgroundImage`, entity `images`, book `thumbnail`) hold one string:

- A base64 data URL, such as `data:image/png;base64,…`
- Or an `http` or `https` URL. The app loads the image from that address

**Background music** (`bgm`) is a base64 data URL.

**Uploaded audio and models** (`customPlayerVRM`, location `ambientSound`, entity `sound` and `model`) are a `MediaAsset`:

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `data` | ✓ | String | A base64 data URL |
| `type` | ✓ | String | The MIME type, such as `model/vrm` |
| `name` | | String | The original file name |
| `size` | | Number | The file size in bytes |

```json
{ "data": "data:model/vrm;base64,...", "type": "model/vrm", "name": "hero.vrm" }
```

## Example World
<!-- keywords: sample, starter, minimal, full file, copy paste, reference json, demo, boilerplate -->

A short world. `...` replaces the media data.

```json
{
  "formamorphKind": "world",
  "version": "3.1.2",
  "worldOverview": {
    "name": "Example World",
    "description": "A small town at the edge of the woods.",
    "author": "Docs",
    "thumbnail": "data:image/png;base64,...",
    "bgm": null,
    "systemPrompt": "A quiet fantasy town. Magic is rare and feared.",
    "use3DModel": false,
    "tags": ["fantasy"],
    "readme": "# Welcome\nYou arrive at dusk.",
    "openings": [
      { "id": "op-1", "text": "{{user}} reaches the town gate as the bell rings.", "kind": "narration" }
    ]
  },
  "stats": [
    {
      "id": "health",
      "name": "Health",
      "type": "number",
      "description": "How hurt you are",
      "min": 0,
      "max": 100,
      "value": 100,
      "regen": 1,
      "descriptors": [
        { "id": "hp-low", "threshold": 30, "description": "badly hurt" },
        { "id": "hp-high", "threshold": 100, "description": "healthy" }
      ]
    }
  ],
  "locations": [
    { "id": "town", "name": "Town Square", "playerDescription": "The center of town.", "isStarting": true },
    { "id": "forge", "name": "Forge", "playerDescription": "Heat and noise.", "parentId": "town" }
  ],
  "connections": [],
  "entities": [
    {
      "id": "smith",
      "name": "Mara",
      "pronouns": "she/her",
      "playerDescription": "The town blacksmith.",
      "aiDescription": "Mara is gruff and fair. She wears a {{ph:garb:world:p-1}}.",
      "locations": ["forge"]
    }
  ],
  "traits": [
    {
      "id": "strong",
      "name": "Strong",
      "playerDescription": "Above-average strength",
      "aiDescription": "This person is unusually strong.",
      "groupId": "body",
      "statChanges": [{ "statId": "health", "value": 20, "type": "max" }]
    }
  ],
  "traitGroups": [
    { "id": "body", "name": "Body", "parentId": null, "order": 0, "maxPicks": 1 }
  ],
  "placeholders": [
    {
      "id": "garb",
      "name": "Garb",
      "values": [
        { "id": "v-1", "text": "leather apron" },
        { "id": "v-2", "text": "soot-black smock" }
      ]
    }
  ],
  "dictionaries": [
    {
      "id": "book-1",
      "name": "Default",
      "enabled": true,
      "entries": [
        { "id": "lore-1", "name": "The War", "key": ["war", "old war"], "value": "A war ended here 40 years ago." }
      ]
    }
  ],
  "statUpdates": []
}
```

## Related

- [🛠️ World Editor](WorldEditor): the editor that writes this format
- [🧮 Stat Code Guide](StatCodeGuide): the `beforeCode` and `code` fields
- [🪪 Personas for Authors](Persona-Authoring): persona marks and rules
- [🔗 Linked Content](LinkedContent): linked copies and world files
