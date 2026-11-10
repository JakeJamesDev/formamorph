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

> 💡 The World Editor has **Export World** too, in the menu of the arrow beside **Save**.

The import adds a new world. It never replaces the world you exported. Import skips a file that fails to load, and the menu tells you.

## How to Add a Stat
<!-- keywords: json, file, list, by hand, manual, schema, field, raw object, property names, regen key, meter entry, required keys -->

1. Add an object to the top-level `stats` list.
2. Give it a new `id` and a `name`. Scripts and the AI find a stat by its name, so keep names unique.
3. Set `type` to `"number"`, or to `"percentage"` for a 0–100 stat.
4. Set `min`, `max`, `value` (the **Base Value**) and `regen`.
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
| `stats` | ✓ | [Stat](#stats)[] | The global stats |
| `statGroups` | | [StatGroup](#stat-groups)[] | Groups for the global stats |
| `locations` | ✓ | [Location](#locations)[] | Places. A location can nest inside another |
| `connections` | | [Connection](#connections)[] | Travel links between locations. Absent = travel follows nesting only |
| `entities` | ✓ | [Entity](#entities)[] | People, creatures, objects and fixtures |
| `entityGroups` | | [Group](#entity-groups)[] | Editor-only groups for entities |
| `traits` | ✓ | [Trait](#traits)[] | The world's traits |
| `traitGroups` | | [TraitGroup](#trait-groups)[] | Groups for the world's traits |
| `placeholders` | | [Placeholder](#placeholders)[] | The world's shared placeholders |
| `placeholderGroups` | | [Group](#placeholder-groups)[] | Editor-only groups for shared placeholders |
| `dictionaries` | ✓ | [Dictionary](#dictionaries)[] | Lore books. Import makes one empty book when the list is absent or empty |
| `statUpdates` | ✓ | [StatUpdate](#stat-updates)[] | An older field. Write `[]` |
| `scripts` | | [Script](#scripts)[] | Scripts no stat or trait owns. They run with no `self` |
| `tools` | | [Tool](#world-tools)[] | The World Tools, in **Tools** tab order. Absent = none |
| `items` | | [Item](#items)[] | The world's items, in **Items** tab order. Absent = none |
| `currencies` | | [Currency](#currencies)[] | The world's money, in order. The first is the **Default**. Absent = none |
| `slots` | | [Slot](#slots-and-bodies)[] | Where items equip, such as Hand. Absent = none |
| `bodies` | | [Body](#slots-and-bodies)[] | Which slots each owner has. The first is the **Default**. Absent = no owner has slots |
| `placements` | | [Placement](#starting-items)[] | The Starting Items. Absent = none |

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
| An entity `images` list of strings | Each string as `{ "data": … }` |
| A location `backgroundImage` string | The first item of `images` |
| A location `entities` list | Each entity's `locations` |
| A location `connections` list of names | Records in the top-level `connections` |
| A connection with `from`, `to`, `twoWay` and `aiHint` | A connection with `a`, `b` and legs |
| A location `isStartLocation` flag | `isStarting` |
| Placeholder `values` as strings, `weights` keyed by text | Value records, weights keyed by value `id` |
| `worldOverview.openingCue` and `openingCueEnabled` | One Opening Action in `openings` |
| `worldOverview.playerSetting` | `allowedPersonas` and `startPersona` |
| A trait group `exclusive: true` | `maxPicks: 1` |
| An entity link to a trait outside Blueprints | Removed, with its overrides |
| A stat's `beforeCode` and `code` | Scripts with the timings `"before"` and `"after"` |
| A script that uses `stats.find(…)` | The same code with the stat map |
| A root `customPlayerVRM` | An Avatar in `worldOverview.vrmStore`. See [Avatar Picks](#avatar-picks) |
| An entity `startingLocationId` | Removed. A persona's `locations` are where it can start |
| A stat with `type: "list"` | A `number` stat at its `min`. The items are dropped |
| A Stomach, Fatness or Breastsize stat with no `morphBindings` | The matching body morphs |
| A `morphBindings` entry that is a bare name | `{ name }` |
| Entity and location `inGameDescription` and `detailedDescription` | `playerDescription` and `aiDescription` |
| A trait `description` | Both `playerDescription` and `aiDescription` |

> ⚠️ **The last four rows run only when `version` is not the app's version.** A file stamped with the current version keeps those older forms as written.

Write new files in the current shape. A file with `scripts` loads in an older version of the app, but its scripts don't run there.

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
| `tags` | ✓ | String[] | Listing tags |
| `vrmStore` | | Object | The world's Avatars, keyed by `id`. Each value is `{ "name": String, "file": MediaAsset, "hash": String }`. `hash` is optional. Entities refer to an entry by `id` through `vrmPick` |
| `legacyVrmFallback` | | [Avatar pick](#avatar-picks) | Written by the migration of an older world, not for authors. It gives the played entity an Avatar when that entity has none. Absent = no fallback |
| `readme` | | String | Markdown the player sees when play starts |
| `introReadme` | | String | Markdown the player sees on the first setup screen. It shares the readme's on and off switch |
| `promptOverrides` | | Object | The world's **Custom Prompts**. See below. Absent = the player's prompts |
| `openings` | | [Opening](#openings)[] | The world's own openings, in order |
| `openingWeights` | | Object | Draw weight per opening `id`. A missing entry weighs 1. `0` keeps an opening and never draws it |
| `allowedPersonas` | | `"any"` \| `"world"` | Which personas the player can pick. `"world"` allows only this world's personas and its Custom Persona. Absent = `"any"` |
| `startPersona` | | Object | The persona a new player starts on: `{ "source": "none" }`, or `{ "source": "world", "entityId": "<entity id>" }`. Absent = the player's default persona |
| `mapBackground` | | Object | The picture behind the Locations canvas and the in-game Map. See below. Absent = none |

See [Persona Rules](Persona-Authoring#persona-rules) for how the last two fields behave.

**`mapBackground`** holds the world map art:

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `images` | ✓ | [Gallery image](#media-fields)[] | One or more images. During the game, the Map shows the first visible one. A condition with no `owner` reads the played persona. The editor's canvas shows the first |
| `frame` | ✓ | Object | `{ "x", "y", "width", "height" }` in canvas units. Every image fits inside it at its own aspect ratio |
| `opacity` | ✓ | Number | From `0` to `1` |

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

Each stat is a number the game tracks. A stat in the top-level `stats` is global. A stat in an entity's `stats` is the entity's own, with the same fields. The AI reads it, and a [script](ScriptsGuide) can calculate it.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The name. Scripts and the AI find the stat by it |
| `type` | ✓ | `"number"` \| `"percentage"` | A `percentage` stat has `min` 0 and `max` 100, and shows as `N%`. The AI can't change its max |
| `description` | ✓ | String | What the stat means |
| `min` | ✓ | Number | The lowest value |
| `max` | ✓ | Number | The highest value |
| `value` | | Number | The **Base Value**: what a new game starts at, before traits apply. Absent or `0` = `min` |
| `starting` | | Number | The value a save gets when it did not have this stat yet. A new game also measures turn one's change from it. Absent = `value`. Keep it equal to `value` |
| `regen` | ✓ | Number | The change per story hour. Negative drains |
| `regenUnit` | | `"minutes"` \| `"hours"` \| `"days"` \| `"weeks"` | The span the editor shows **Regen** per. `regen` stays per hour. Absent = `"hours"` |
| `descriptors` | ✓ | [Descriptor](#stat-descriptors)[] | Text for each band of values |
| `thresholdUnit` | | `"raw"` \| `"percent"` | What a descriptor's `threshold` measures. `"raw"` = the stat's own units. `"percent"` = a percent of `min` to `max`. Absent = `"raw"`. A `percentage` stat is always percent |
| `scripts` | | [Script](#scripts)[] | Code with this stat as `self`. See the [Scripts Guide](ScriptsGuide) |
| `morphBindings` | | `{ name, by? }`[] | Avatar sliders this stat changes. From `min` to `max`, the stat adds 0 up to `by` to slider `name`. Absent `by` = 1. A negative `by` makes the slider smaller. The changes of several stats on one slider add up |
| `colorBindings` | | `{ channel, color }`[] | Avatar colors this stat blends toward `color` (`#rrggbb`), in OKLab. `channel` is `skin`, `eye` or `hair`, once each. From `min` to `max`, the blend goes from 0 to the full target, and stops there. Several stats on one channel apply in stat-tree order. Avatars only |
| `enabled` | | Boolean | `false` starts the stat off. The player and the AI don't see it, and regen and code stop. A trait's `statToggles` switches it on. Absent = on |
| `hidden` | | Boolean | `true` hides the stat from the player. The AI still reads it, and regen and code still run |
| `noIncrease` / `noDecrease` | | Boolean | The AI can't raise or lower the value |
| `noIncreaseMax` / `noDecreaseMax` | | Boolean | The AI can't raise or lower the max |
| `groupId` | | String \| `null` | The [stat group's](#stat-groups) `id`. Absent, `null` or a group the owner lacks = the top level |
| `order` | | Number | The order among the stats and groups with the same parent |

### Scripts
<!-- keywords: scripts, beforeCode, code field, before the ai, after the ai, during ai output, at game start, when a trait switches, run order, timing -->

A script is one box of code with a timing. A stat, a trait, an item and the world each hold a `scripts` list.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | | String | The script's name. Absent = the owner and timing name it |
| `timing` | ✓ | `"before"` \| `"after"` \| `"output"` \| `"start"` \| `"switch"` | When it runs. `"before"` runs before the AI's turn, and its changes reach that turn's prompt. `"after"` runs after the AI's changes and regen. `"output"` runs on each completed narration sentence. `"start"` runs once on a new game's opening turn. `"switch"` runs when a trait turns on or off. An item takes [its own timings](#items) |
| `code` | ✓ | String | The JavaScript |
| `order` | | Number | Run position within the timing. Scripts with an `order` run first, lowest first. The rest run after them, world scripts first, then each stat's in stat order |

When two scripts write the same field, the later one wins. A world script has no `self`. A trait's script runs only while the trait is active. The [Scripts Guide](ScriptsGuide) lists what each timing reads.

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
| `target` | | `"global"` | On an entity's trait, `"global"` moves the global stat with this `id`, even when the entity has its own stat with the same `id`. Absent = the entity's own stat first, else the global stat |

A `statToggles` entry takes the same `target`.

> 🔁 Older files write `"target": "player"`. The app reads it as `"global"`, and new files write `"global"` only. Formamorph 3.2 and earlier don't read `"global"`, so they apply these rows to the entity's own stat.

### Stat Groups

A group holds stats and other groups. The world's `statGroups` group the global stats. An entity's `statGroups` group its own stats. A group only organizes: it has no modes or pick counts.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The group name |
| `aiDescription` | | String | A heading the AI reads above the group's stats |
| `aiVisible` | | Boolean | `false` keeps the heading from the AI. Its stats move up one level. Absent = `true` |
| `parentId` | ✓ | String \| `null` | The parent group's `id`. `null` = the top level |
| `order` | | Number | The order among the stats and groups with the same parent |
| `system` | | `"blueprints"` | Marks the world's Blueprints group. Its stats are [Blueprint stats](World-Editor-Stats#blueprint-stats-and-links), which reach play only through an entity's [stat link](#stat-links). Only one world group has it. An entity's group never has it |

### Stat Links

A stat link gives a Blueprint stat or stat group to an entity. During the game, each linked stat runs under the original stat's `id`, with the entity's own value. The link takes every change to its original, except in the fields it overrides.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `originalId` | ✓ | String | The `id` of the Blueprint stat or stat group |
| `kind` | ✓ | `"stat"` \| `"group"` | What the original is |
| `originalName` | ✓ | String | The original's name. When an entity joins a world, its link finds the original by `originalId`, then by this name |
| `groupId` | ✓ | String \| `null` | One of the entity's own stat group `id`s. `null` = the entity's top level |
| `order` | | Number | The order among the entity's stats, links and groups with the same parent |
| `overrides` | | Object | Overrides per stat. The key is the original stat's `id`. A linked group keys each of its stats here |
| `keyNames` | | Object | Outside a world only, such as in an entity file: stat `id` to name, for each key of `overrides` |

Each override map can hold any [stat field](#stats) except `id`, `name`, `starting`, `groupId` and `order`. `value` is the **Base Value**. Each field holds `{ "value": …, "blueprint": … }`, as on a [trait link](#trait-links). An entity links each original stat one time.

## Traits
<!-- keywords: perk properties, prerequisite object, pick limits keys, mode values, default flag, category object, template folder flag, toggle flag -->

A trait describes the player or an entity. The player picks traits before play. An entity can own traits too.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique across the world and every entity |
| `name` | ✓ | String | The name |
| `playerDescription` | | String | What the player reads on the setup screen |
| `aiDescription` | | String | What the AI reads while the trait is active |
| `statChanges` | ✓ | [StatChange](#stat-changes)[] | Changes to stats while the trait is active. A global trait changes global stats. An entity's trait changes the entity's own stats, and global stats through a `"global"` row |
| `groupId` | | String \| `null` | The [group's](#trait-groups) `id`. Absent or `null` = the top level |
| `order` | | Number | The order among items in the same group |
| `isDefault` | | Boolean | The trait starts selected |
| `playerToggle` | | Boolean | The player can switch the trait on and off during the game |
| `mode` | | `"alwaysOn"` \| `"hidden"` | Absent = Optional: the player picks. `"alwaysOn"` is active while its requirements hold, and the player can't switch it. `"hidden"` acts as `"alwaysOn"`, and the player never sees it. Both ignore `isDefault` and `playerToggle` |
| `requires` | | [Requirement row](#trait-requirements)[] | Any one row that holds makes the trait available. Absent or empty = always available |
| `statToggles` | | `{ "statId", "enabled" }`[] | Stats switched on or off while the trait is active |
| `placeholderPins` | | [Pin](#placeholder-pins)[] | Placeholder values pinned while the trait is active |
| `body` | | `{ "pick"? }` | The Body its owner takes while the trait is active. `pick` is a [Body pick](#slots-and-bodies) other than absent. No `pick` = the row sets no Body |
| `morphPins` | | `{ "name", "value" }`[] | Avatar sliders held at `value` while the trait is active, in place of the player's own. Any number. Bound stats add on top. When two active traits set one slider, the one switched on last wins. A link can't override it |
| `colorPins` | | `{ "channel", "color" }`[] | Avatar colors (`skin`, `eye` or `hair`, once each) set to `color` (`#rrggbb`) while the trait is active, in place of the player's own. Bound stats blend on from it. When two active traits set one channel, the one switched on last wins. A link can't override it. Avatars only |
| `scripts` | | [Script](#scripts)[] | Code with this trait as `self`. It runs while the trait is active. See the [Scripts Guide](ScriptsGuide) |

See [World Editor: Traits](World-Editor-Traits) for how modes, requirements and pick counts behave during the game.

### Trait Requirements

`requires` is a list of rows. Each row is `{ "all": [ … ] }`: a list of requirements. A row holds when every requirement in it holds. A row is never empty.

```json
"requires": [
  { "all": [{ "kind": "trait", "id": "knight" }, { "kind": "trait", "id": "heavy-build" }] },
  { "all": [{ "kind": "trait", "id": "mercenary" }] }
]
```

> 🔁 Older files store `requires` as a flat list of requirements. The app reads each one as a row of its own.

Each requirement has a `kind`:

| `kind` | Other fields | Holds when |
|---|---|---|
| `"trait"` | `id`, `name`, `owner` | The owner has the trait with this `id` |
| `"group"` | `id`, `name`, `owner` | The owner has any trait in the group with this `id` |
| `"playingAs"` | `id`, `name` | The player plays as the entity with this `id` |
| `"stat"` | `id`, `name`, `owner`, `operator`, `value`, `unit` | The owner's stat with this `id` compares true against `value` |
| `"item"` | `id`, `name`, `owner`, `status`, `state`, `identity` | The owner has a copy of the [item](#items) with this `id`: any copy under `status: "owned"`, or an equipped one under `"equipped"` |
| `"time"` | `dayparts` | The story clock's time of day is one of `dayparts` |

- `name` is optional. It holds the target's name, so a requirement still reads when the target is gone.
- A `"stat"` requirement's `operator` is one of `">"`, `"<"`, `">="`, `"<="`, `"="` or `"≠"`. Its `unit` is `"raw"` for the stat's own units or `"percent"` for a share of the stat's min→max span. `{ "kind": "stat", "id": "health", "operator": "<", "value": 20, "unit": "percent" }` holds while Health is under 20% of its range.
- `owner` is optional. It applies only to a trait, group, stat or item an entity owns. A requirement whose target is global (a root trait, a root group or a global stat) reads the global scope. The app drops any `owner` stored with it. Absent = the trait's own owner. `{ "kind": "you" }` checks the entity the player plays, and never holds when the player plays none. `{ "kind": "entity", "id": "<entity id>", "name": "…" }` checks that entity.
- An `"item"` requirement's `state` and `identity` are optional. They narrow it to a copy with that State word (any case, ends trimmed) or that identity, `"identified"` or `"unidentified"`. On an item, a requirement with no `owner` reads the Item Copy's owner, and never holds while the copy lies at a location.
- A `"time"` requirement's `dayparts` lists one or more of `"night"`, `"dawn"`, `"morning"`, `"midday"`, `"afternoon"` and `"evening"`. It has no `id`, `owner` or `not`. `{ "kind": "time", "dayparts": ["evening", "night"] }` holds from evening until dawn.
- `not` is optional. `true` flips the requirement: it holds while its target is off. `{ "kind": "trait", "id": "paladin", "not": true }` holds while the owner doesn't have Paladin.
- A requirement whose target is gone never holds, with or without `not`.

> 🔁 Older files name the owner under `bearer`. The app reads it as `owner`, and new files write `owner` only. Apps from v3.1 and v3.2 don't read `owner`, so they misread these requirements until updated.

### Trait Groups

A group holds traits and other groups. Both the world and each entity have a `traitGroups` list.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The heading on the setup screen |
| `playerDescription` | | String | Text the player reads under the heading |
| `aiDescription` | | String | A header the AI reads above the group's active traits |
| `aiVisible` | | Boolean | `false` keeps the group's name and description from the AI. Its traits and subgroups move up one level. Absent = `true` |
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
| `images` | | [Gallery image](#media-fields)[] | The gallery, in author order. During the game, the backdrop shows the first visible image |
| `imageTags` | | String | Comma-separated tags for image generation |
| `ambientSound` | | [MediaAsset](#media-fields) | Looping sound |
| `isStarting` | | Boolean | A new game can start here. One marked = every game starts there. Several = the player picks. None = any location. A played entity's `locations` join the choices |
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
| `distance` | | String | `"far"` = the AI gets nothing about the entities at the other end. Travel is unchanged. Absent = Nearby |

A connection needs at least one leg. Both legs = two-way. A leg has one optional field, `hint`: how the trip is made, such as "through the old gate". The AI reads it after the destination's name when the destination is one step away.

## Entities
<!-- keywords: npc properties, character object, persona marks, nickname list, gallery array, link object keys, card file extras, folder key -->

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The name |
| `aliases` | | String[] | Other names. The AI reads them. The app finds them in the story text, case-sensitive and whole-word |
| `pronouns` | | String | Free text, such as "she/her". The AI reads it |
| `type` | | String | An optional category label |
| `strangerName` | | String | The **Stranger Name**: what the player calls the entity before meeting it. Absent = the player has met it from the start. See [Strangers](World-Editor-Entities#strangers) |
| `strangerDescription` | | String | The **Stranger Description**: what the player reads about the entity before meeting it |
| `persona` | | Boolean | The **Persona** mark. See [Persona Marks](#persona-marks) |
| `personaOnly` | | Boolean | The entity exists only while the player plays it |
| `customPersona` | | Boolean | The **Custom Persona** mark |
| `body` | | [Body pick](#slots-and-bodies) | The Body it equips into. Absent = the Default |
| `playerDescription` | | String | What the player reads |
| `aiDescription` | | String | The full description the AI reads |
| `aiSummary` | | String | A short description the AI reads where the full one is too long |
| `images` | | [Gallery image](#media-fields)[] | The gallery, in author order. The first image is the main one |
| `tags` | | String[] | Listing tags for Community Creations |
| `imageTags` | | String | Comma-separated tags for image generation |
| `sound` | | [MediaAsset](#media-fields) | A sound |
| `model` | | [MediaAsset](#media-fields) | A 3D model |
| `vrmPick` | | [Avatar pick](#avatar-picks) | The entity's Avatar. Absent = none |
| `locations` | | String[] | The `id`s of the locations where the entity can be. For a Unique or a Generic entity the app writes it from `starts`: every Start place and every schedule place |
| `kind` | | `"unique"` \| `"generic"` | A Unique entity is one body in one place. A Generic entity runs every Start at once, one presence each. Absent for the Custom Persona and an entity with no locations |
| `starts` | | [Start](#starts)[] | The entity's beginnings, in author order. A Unique entity picks one by `weight` in each new game. A Generic entity runs all of them |
| `traversable` | | `"anywhere"` \| String[] | Where a Unique entity may be led or called beyond its schedule: anywhere, or exact location `id`s. Absent = an empty list: its schedule places only. A Generic entity ignores it |
| `knownIn` | | `"nowhere"` \| String[] | **Known In**: where the AI knows of the entity while it isn't present. `"nowhere"`, or location `id`s, each with every location below it. Absent = **Nearby** |
| `relationships` | | `{ "targetId", "label" }`[] | **Relationships**, in author order, at most one per target. `targetId` is another entity's `id`, or `"you"` for the played persona. `label` is the target's role toward this entity |
| `groupId` | | String \| `null` | Editor-only. The [entity group's](#entity-groups) `id`. Absent or `null` = no group |
| `order` | | Number | Editor-only. The order in its group |
| `openings` | | [Opening](#openings)[] | The entity's own openings |
| `openingWeights` | | Object | Draw weight per opening `id`, as in `worldOverview` |
| `placeholders` | | [Placeholder](#placeholders)[] | Placeholders the entity owns, and its [copies](#copies) |
| `traits` | | [Trait](#traits)[] | Traits the entity owns. They describe it to the AI. They are the player's when the player plays it |
| `traitGroups` | | [TraitGroup](#trait-groups)[] | Groups for the entity's own traits |
| `traitLinks` | | [TraitLink](#trait-links)[] | Links to Blueprints traits and groups |
| `traitPlacement` | | `{ "groupId", "order" }` | Where the entity's node sits in the world's Traits tree. `groupId` is a world group `id` or `null` for the top level. Absent = the end of the top level |
| `stats` | | [Stat](#stats)[] | Stats the entity owns, in order. They are the persona's stats when the player plays it |
| `statGroups` | | [StatGroup](#stat-groups)[] | Groups for the entity's own stats |
| `statLinks` | | [StatLink](#stat-links)[] | Links to Blueprint stats and stat groups |
| `statPlacement` | | `{ "groupId", "order" }` | Where the entity's node sits in the world's Stats tree, as `traitPlacement` does for Traits |
| `link` | | [ContentLink](#linked-copies) | What library item this copy follows. Absent = it follows nothing |

#### Starts

| Field | Type | Meaning |
|---|---|---|
| `id` | String | Unique within the entity |
| `place` | String | The location `id` where the entity begins, or `"@playerStart"`: wherever the player begins, fixed when the game starts |
| `weight` | Number | A positive whole number. Higher is picked more often. A Generic entity ignores it |
| `schedule` | Row[] | The daily routine kept from there. Empty = it stays at `place` |
| `beginsFollowing` | `true` | Only with `"@playerStart"`, on a Unique entity: a game that picks this Start begins with the entity following the player, even on a `strict` row. `traversable` still applies. Absent = not following |

A Start at `"@playerStart"` adds no place to `locations`. Its schedule can name any location; play skips one the player's real start doesn't connect to.

Each schedule row:

| Field | Type | Meaning |
|---|---|---|
| `id` | String | Unique within the Start |
| `time` | `"allDay"` \| `{ "start", "end" }` | Minutes from midnight. An `end` before `start` runs past midnight. A timed row wins over the All-day row for its hours |
| `strict` | Boolean | During the row a Unique entity can't be called over and won't start following. A Generic entity ignores it |
| `action` | Object | `{ "kind": "stay", "place" }`, `{ "kind": "wander", "places": [{ "place", "weight" }], "idle" }` or `{ "kind": "patrol", "stops": [{ "place", "idle" }] }`. `idle` is in minutes |

In hours no row covers, the entity stays at its Start's `place`.

A Generic entity is one entity with one set of stats, items and memories. Each of its Starts plays as its own presence on its own schedule, and two Starts can share a place. Where two presences meet, the entity is listed once. A Generic entity is never called over and never follows.

> 🔁 An older world file used `presence` and `movement`. The app maps them when it opens the world: an entity at one location, or with **One, at Random**, becomes a Unique entity with one Start per location; **Moves Between** becomes an all-day wander over its locations; **Can Follow** becomes `traversable: "anywhere"`. Any other entity at several locations becomes a Generic entity with one Start per location and no rows.

`statChanges` and `statToggles` on an entity's own traits act on the entity's own stats. A row acts on the global stat when its `target` is `"global"`, or when the entity has no stat with that `id`.

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

A link gives a [Blueprints](#blueprints) trait or group to an entity. The entity does not get its own trait. The link takes every change to its original, except in the fields it overrides.

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

Each override map can hold `isDefault`, `requires`, `placeholderPins`, `playerToggle`, `statChanges`, `mode` and `scripts`. `scripts` overrides the whole list. `mode` takes `"optional"`, `"alwaysOn"` or `"hidden"`. Each field holds `{ "value": …, "blueprint": … }`: your value, and the original's value when you set it. The app uses `blueprint` to tell you when the original changed.

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

A placeholder is a named value that a chip shows in text. The world's `placeholders` are shared. An entity's, an item's or a book's `placeholders` belong to it.

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
| `placeholderId` | ✓ | String | The placeholder's `id`. On a trait, a blueprint `id` pins each owner's copy |
| `value` | ✓ | String | The value's text |
| `valueId` | | String | The value's `id`. When present, it wins over `value`, so a reworded value still matches |

### Copies

A world shared placeholder in the [Blueprints group](#placeholder-groups), or a group below it, is a **blueprint**. An entity holds a copy of each blueprint its traits need, in its own `placeholders`, with `blueprintId` set. The app makes copies when it loads the world.

A copy takes every change to its blueprint's values. Its own `values` hold only the values it adds. Its `valueOverrides` map a blueprint value `id` to changes:

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

The editor can add two more parts after the placement id. One is a path to a part of the placeholder. The other is a label after `:=`. Copy those from a chip the editor wrote.

Two chips need no placeholder. `{{user}}` is the [Persona Name chip](Persona-Authoring#the-persona-name-chip). `{{char}}` is the [Entity Name chip](Persona-Authoring#the-entity-name-chip).

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
| `matchWholeWords` | | Boolean | Keywords match whole words only, regex keywords included |
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

## Items
<!-- keywords: item object, item fields, effects array, equip requirements key, uses, when empty, stackable flag, bound flag, slot rule, either of, all of, unidentified name, item scripts -->

An item is a kind of object. During the game, a save holds Item Copies of it. See [World Editor: Items](World-Editor-Items) for how items behave.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The name |
| `playerDescription` | | String | What the player reads |
| `aiDescription` | | String | The full description the AI reads |
| `aiSummary` | | String | A short description the AI reads where the full one is too long |
| `unidentifiedName` | | String | The name an unidentified Item Copy shows. With it or `unidentifiedDescription` set, every copy starts unidentified |
| `unidentifiedDescription` | | String | The description an unidentified Item Copy shows. Blank = `playerDescription` |
| `images` | | [Gallery image](#media-fields)[] | The gallery, in author order. A condition with no `owner` reads the Item Copy's owner |
| `imageTags` | | String | Comma-separated tags for image generation |
| `icon` | | String | What the Inventory panel shows: an icon id, or `"none"` for the item's image. Absent, or an id the game doesn't know, derives an icon from the name, then the slot |
| `placeholders` | | [Placeholder](#placeholders)[] | Placeholders the item owns. They roll once per game, and every Item Copy shows the same value |
| `value` | | Number | What the item is worth, in the base unit of its Currency |
| `currencyId` | | String | The id of the [Currency](#currencies) it is priced in. Absent, or an id the world doesn't have = no price |
| `stackable` | | Boolean | `false` = copies never group into one row. Absent = stackable. Ignored while `uses` is 2 or more |
| `uses` | | Number | The uses each Item Copy starts with, from 1. Absent = unlimited |
| `whenEmpty` | | Object | What a copy's last use leaves: `{ "kind": "stays" }`, `{ "kind": "gone" }`, `{ "kind": "becomes", "itemId": "<item id>" }` or `{ "kind": "changesState", "state": "…" }`. Used only while `uses` is set. Absent = gone |
| `state` | | String | The State word each Item Copy starts with. Absent = none |
| `bound` | | Boolean | `true` = the player can't drop or give its copies |
| `slotRule` | | Object | The [slots](#slots-and-bodies) it equips into: `{ "mode": "either", "slotIds": ["<slot id>", …] }` takes one of them, the first free in this order. `"mode": "all"` takes all of them. Absent = not equippable |
| `statEffects` | ✓ | Stat effect[] | Changes to the owner's own stats. See below |
| `traitEffects` | ✓ | Trait effect[] | Traits the owner holds. See below |
| `equipRequires` | ✓ | [Requirement row](#trait-requirements)[] | Any one row that holds lets an owner equip it. Empty = any owner can |
| `scripts` | | [Script](#scripts)[] | Code that runs on an event of one of its Item Copies. `timing` is `"gained"`, `"lost"`, `"equipped"`, `"unequipped"` or `"used"` |

Each stat effect:

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `statId` | ✓ | String | The owner's stat with this `id` |
| `facet` | ✓ | `"value"` \| `"min"` \| `"max"` \| `"regen"` | The part of the stat it changes |
| `timing` | ✓ | `"equipped"` \| `"owned"` \| `"used"` \| `"firstObtain"` | **While Equipped**, **While Owned**, **After Use** or **On First Obtain** |
| `duration` | | Object | Under `"used"` only: `{ "kind": "permanent" }`, or `{ "kind": "time", "hours": N }` of story time |
| `amount` | ✓ | Number | The amount to add. Negative subtracts |
| `op` | ✓ | `"add"` | Write `"add"` |

Each trait effect has `id`, `traitId`, `timing` and `duration`, with the same meanings. The owner holds the trait with that `id` while the timing holds.

## Currencies

A Currency is a kind of money. See [World Editor: Items](World-Editor-Items) for how to set one up.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The name the player reads after a price, such as Credits |
| `backing` | ✓ | Object | What holds the money. See below |

Each `backing` is one of these:

| Backing | Meaning |
|---|---|
| `{ "kind": "stat", "statId": "<stat id>" }` | A number on a stat: a global stat, a stat a Persona links, or a Persona's own stat |
| `{ "kind": "items", "items": [{ "itemId": "<item id>", "worth": 1 }, …] }` | Items, each with its worth in the base unit. The smallest item is worth 1, and each worth is a whole number used once. An item backs one Currency at most. The game reads an item's `value` as these items, largest first |
| `{ "kind": "name" }` | A name only, with no tracking |

The game drops a Currency with no `id`, no `name` or an unknown `backing`.

## Slots and Bodies
<!-- keywords: equipment slots, capacity, hands, rings, body type, default body, none, wear, equip where, slot rule, two handed -->

A **slot** is a name only. A **Body** lists the slots an owner has, and how many items each one holds. Items equip into the slots of their owner's Body.

| Slot field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The name, such as "Hand" |

| Body field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The name, such as "Humanoid" |
| `entries` | ✓ | Entry[] | The Body's slots, in the order the Inventory panel lists them |
| `backdrop` | | Backdrop | The figure the boxes sit on. Absent = Humanoid |
| `aspect` | | Number | The figure's width divided by its height, 0.3 to 3. Absent = 0.5 |

| Entry field | Req. | Type | Meaning |
|---|---|---|---|
| `slotId` | ✓ | String | The slot's `id` |
| `capacity` | | Number | How many items fit, up to 99. Absent = 1 |
| `boxes` | | Box[] | One box per capacity unit. A missing box starts small, at the center |

| `backdrop.kind` | Meaning |
|---|---|
| `"humanoid"` | A standing figure |
| `"quadruped"` | A four-legged figure |
| `"plain"` | No figure |
| `"image"` | The `image` you give it. `opacity` is a number from 0 to 1 that fades it. Absent = 1 |

A **box** has `x`, `y`, `w` and `h`, each a fraction of the figure from 0 to 1, so a box keeps its place when the aspect changes. Its smallest width and height are 0.04.

An entity's `body` picks its Body:

| `body` | Meaning |
|---|---|
| absent | The **Default**: the first Body in `bodies` |
| `{ "kind": "none" }` | No Body. The entity carries items but equips none |
| `{ "kind": "body", "id": "…" }` | That Body. An `id` the world lacks reads as the Default |

The player's Body comes from the persona they play. A world persona uses its own `body`. With no persona, or with a library persona, the player uses the Custom Persona entity's `body`. Library entities and story-invented entities use the Default.

A trait's `body` row overrides this while the trait is active. A world trait sets the player's Body, and an entity's own trait sets that entity's. When several active traits set one, the trait switched on last wins. A save records that order in `bodies.traitsOn`, for traits with a `body` pick, `morphPins` or `colorPins`.

```json
"slots": [{ "id": "hand", "name": "Hand" }, { "id": "collar", "name": "Collar" }],
"bodies": [
  { "id": "humanoid", "name": "Humanoid", "entries": [{ "slotId": "hand", "capacity": 2 }] },
  { "id": "dog", "name": "Dog", "entries": [{ "slotId": "collar" }] }
]
```

## Starting Items
<!-- keywords: placements, starting items key, starting gear json, give item at start, place item at location, hidden item, start equipped -->

`placements` lists the [Starting Items](World-Editor-Items#starting-items): the Item Copies a new game begins with. A saved game never reads it.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `where` | ✓ | Object | `{ "kind": "you" }` for the player, `{ "kind": "entity", "id": "<entity id>" }`, or `{ "kind": "location", "id": "<location id>" }` |
| `quantity` | ✓ | Number | How many copies |
| `hidden` | | Boolean | `true` = the player doesn't see the copies until the story reveals them |
| `equipped` | | Boolean | `true` = the copies start equipped. Never on a location |
| `source` | ✓ | Object | `{ "kind": "item", "itemId": "<item id>" }` |

## World Tools
<!-- keywords: tools key, world tool json, function object, params array, handler object, lookup, template, script handler, offered to, call limit -->

`tools` lists the world's own Tools. See [Tools](Tools) for how they behave.

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | String | Unique id |
| `name` | ✓ | String | The function name the AI calls |
| `description` | ✓ | String | What the AI reads to decide when to call the Tool |
| `params` | ✓ | Param[] | The arguments the AI passes. See below |
| `handler` | ✓ | Object | What runs when the AI calls the Tool. See below |
| `emptyResult` | ✓ | String | The text the AI gets when the handler finds nothing |
| `offeredTo` | ✓ | String[] | The prompts that send the Tool, such as `"narration"` or `"choices"` |
| `intents` | | String[] | Formaquestion Tools only. A world file doesn't need it |
| `callLimit` | | Number | Calls allowed per request. Absent = the global default |

Each param has `name`, `type` (`"string"`, `"number"`, `"boolean"` or `"enum"`), `description`, `required` (Boolean) and `options` (the values of an `"enum"`, else `[]`).

`handler` has a `kind`:

| `kind` | Other fields |
|---|---|
| `"lookup"` | `source`: `"entities"`, `"locations"` or `"dictionary"`. `param`: the param it searches by. `returns`: `"full"` or `"summary"` |
| `"template"` | `body`: the text it returns |
| `"script"` | `code`: the JavaScript. `timing`: `"call"`, `"output"` or `"after"`; absent = `"call"`. `reply`: the text an `"output"` or `"after"` call answers with; blank = `"Done."`. `stack`: `true` = every call in a turn fires |

## Stat Updates
<!-- keywords: deprecated list, unused, empty array, obsolete, leftover, what is this for -->

`statUpdates` is an older list. No screen edits it, and play does not read it. Write `[]`. An older file can hold records with `id`, `name`, `prompt`, `stats` (stat names) and `messageHistory`.

## Media Fields
<!-- keywords: base64, embed binary, encode image, huge file size, web address string, audio encoding, mime, asset object -->

**Images** (`thumbnail`, a gallery image's `data`, book `thumbnail`) hold one string:

- A base64 data URL, such as `data:image/png;base64,…`
- Or an `http` or `https` URL. The app loads the image from that address

**Gallery images** (entity, location and item `images`, and `mapBackground.images`) are objects:

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `data` | ✓ | Image | The picture |
| `requires` | | [Requirement rows](#trait-requirements) | The Visibility rule. Absent = always shown. On a location or the Map Background, a condition with no `owner` reads the played persona |

**Background music** (`bgm`) is a base64 data URL.

**Uploaded audio and models** (the `file` of a `vrmStore` entry, location `ambientSound`, entity `sound` and `model`) are a `MediaAsset`:

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `data` | ✓ | String | A base64 data URL |
| `type` | ✓ | String | The MIME type, such as `model/vrm` |
| `name` | | String | The original file name |
| `size` | | Number | The file size in bytes |

```json
{ "data": "data:model/vrm;base64,...", "type": "model/vrm", "name": "hero.vrm" }
```

## Avatar Picks
<!-- keywords: vrm pick, entity avatar, avatar store reference, user's default, legacy keys, use3DModel, customPlayerVRM -->

An Avatar pick says which Avatar an entity shows. It is an object with a `kind`:

| Shape | Meaning |
|---|---|
| `{ "kind": "default" }` | **User's Default**: the player's default Avatar |
| `{ "kind": "world", "id": "<vrmStore id>" }` | An Avatar in the world's `vrmStore` |
| `{ "kind": "library", "id": "<id>" }` | An Avatar in the player's library. Library entities use this form. A world file never holds it. |

Entities share an Avatar by naming the same `id`. A pick of an `id` the store lacks reads as none. An entity card or entity listing that carries a pick also carries the Avatar file.

A world file from an older version can hold `use3DModel` and `customPlayerVRM` in `worldOverview`. The app moves the Avatar into `vrmStore` and sets `legacyVrmFallback` only when `use3DModel` is `true`. New files do not write those two keys.

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
- [🧮 Scripts Reference](Scripts-Reference): what a script's `code` can do
- [🪪 Personas for Authors](Persona-Authoring): persona marks and rules
- [🔗 Linked Content](LinkedContent): linked copies and world files
