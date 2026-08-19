# 📐 World Data Format

This is the reference for a Formamorph **world** — the `.json` you export from the editor, import in the main menu, or ship as a built-in. If you author worlds by hand or tooling, this page describes every field the app reads.

> 💡 You rarely need to write this by hand — the in-app **World Editor** produces and consumes this format for you. This page is for understanding imports/exports and for external tooling.

---

## 🗂️ How worlds are stored

Worlds live in the browser's **IndexedDB**:

| | |
|---|---|
| **Database** | `worldsDB` |
| **Store** | `worlds` |
| **Key path** | `id` |

A world is exported/imported as a single JSON object. The main-menu grid reads a lightweight **preview** (`id`, `name`, `description`, `author`, `thumbnail`, `tags`) without loading the full payload.

## 🔖 Versioning

Every world saved or exported by Formamorph 2.0+ carries a top-level `version` string (e.g. `"2.0.3"`). On import, worlds that don't match the current version are run through a **migration** that upgrades them to the current shape — so anything reaching the editor is already compatible.

| Field | Type | Notes |
|---|---|---|
| `version` | String | App/world format version. **Absent ⇒ treated as legacy (pre-2.0)** and migrated on import. |

> ⚠️ Older (v1.x) worlds stored the custom player model at the top level as `customPlayerVRM`. Migration moves it into `worldOverview.customPlayerVRM` and stamps the current version. You don't need to do this yourself — import handles it.

---

## 🧱 Top-level structure

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier for the world |
| `version` | String | Format version (see above) |
| `worldOverview` | Object | General world info & presentation |
| `stats` | Array | Game mechanics tracked during play |
| `locations` | Array | Places the player can visit (nestable into sub-locations) |
| `connections` | Array | Authored travel links between locations (optional) |
| `entities` | Array | Characters/objects the player can interact with |
| `traits` | Array | Selectable characteristics that modify stats |
| `traitGroups` | Array | Optional folders that organize traits in the editor and selection screen |
| `statUpdates` | Array | Rules the AI uses to change stats during play |
| `dictionaries` | Array | Ordered **books** of lorebook entries injected into the AI prompt on match |

### 🌍 `worldOverview`

| Field | Type | Description |
|---|---|---|
| `name` | String | Display name |
| `description` | String | Detailed description |
| `author` | String | Creator |
| `thumbnail` | String \| null | Data-URL image for the menu card |
| `bgm` | String \| null | Data-URL audio for background music |
| `systemPrompt` | String | Extra context handed to the AI |
| `use3DModel` | Boolean | Whether the world uses a 3D VRM avatar |
| `tags` | String[] | Tags shown/searchable in the world browser |
| `customPlayerVRM` | [MediaAsset](#-media-fields) \| null | Optional per-world custom player `.vrm` |
| `readme` | String | Optional markdown shown to the player on entering the world (per-world "Show Readme" toggle) |
| `openingCue` | String | Optional text the player's input box opens pre-filled with at Start Game, in place of the standard cue. Supports placeholder chips, resolved at pre-fill |
| `openingCueEnabled` | Boolean | Whether `openingCue` is applied. Absent = applied when `openingCue` holds text |

### 📊 `stats`

Each stat is a tracked mechanic. Two kinds exist, set by `type`:

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier |
| `name` | String | Display name (referenced by stat code, by name) |
| `type` | `"number"` \| `"list"` | Numeric gauge, or a list of items |
| `description` | String | What the stat represents |
| `min` / `max` | Number | Value bounds (numeric stats) |
| `starting` | Number | Initial value at game start |
| `value` | Number \| [StatListItem](#stat-list-items)[] | Live value — a number for `number` stats, items for `list` stats |
| `regen` | Number | Amount regenerated per time unit |
| `descriptors` | Array | Threshold-based descriptions (below) |
| `thresholdUnit` | String | `"raw"` (default, and what an absent field means) or `"percent"` — what a descriptor threshold's number measures |
| `code` | String | Optional JS deriving this stat from others — see the **[Stat Code Guide](StatCodeGuide)** |
| `morphBindings` | String[] | Body-mesh morph target names this stat drives; `[min, max]` maps linearly to influence `[0, 1]` |
| `noIncrease` / `noDecrease` | Boolean | Stop the AI from raising/lowering the current value |
| `noIncreaseMax` / `noDecreaseMax` | Boolean | Stop the AI from raising/lowering the max |

#### Stat descriptors

`descriptors` map value thresholds to flavor text the AI sees:

| Field | Type | Description |
|---|---|---|
| `id` | String \| Number | Unique identifier |
| `threshold` | Number | The top of this descriptor's band — a stat value, or a percentage of `min`→`max` when the stat's `thresholdUnit` is `"percent"` |
| `description` | String | Text for the stat at this level |

The lowest band the value fits in wins, whatever order the array is in. A value above every threshold gets no descriptor, and the AI is told no status for that stat.

#### Stat list items

For `type: "list"` stats, `value` is an array of:

| Field | Type | Description |
|---|---|---|
| `id` | String \| Number | Unique identifier |
| `name` | String | Item name |
| `description` | String | Item description |
| `number` | Number | Quantity/weight of this item |

### 🎭 `traits`

Selectable characteristics that adjust stats at character creation.

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier |
| `name` | String | Display name |
| `playerDescription` | String | Shown to the player in the trait-selection screen |
| `aiDescription` | String | Sent to the AI when this trait is selected |
| `statChanges` | [StatChange](#stat-changes)[] | How it modifies stats |
| `groupId` | String \| null | Owning `traitGroups` folder; null/absent = ungrouped |
| `isDefault` | Boolean | Pre-checked in the selection screen |
| `order` | Number | Sibling order among items sharing the same group |
| `playerToggle` | Boolean | The player may switch this trait on and off during play, not only at character creation |
| `statToggles` | `{ statId, enabled }[]` | Stats forced on or off while this trait is active — how a stat authored `enabled: false` becomes visible for one kind of character |
| `placeholderPins` | `{ placeholderId, value }[]` | Placeholder values this trait fixes, overriding the roll |

#### Trait groups

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier |
| `name` | String | Display name |
| `playerDescription` | String | Shown above the group on the selection screen |
| `aiDescription` | String | Becomes a header above this group's chosen traits in the AI prompt |
| `parentId` | String \| null | Parent group `id` for nesting; null = top-level |
| `order` | Number | Sibling order |
| `exclusive` | Boolean | At most one trait in the group may be active — renders as radio buttons. Mark one member `isDefault` so there is always a valid answer; if two are marked, the first in order wins |

#### Stat changes

| Field | Type | Description |
|---|---|---|
| `statId` | String | Target stat's `id` |
| `value` | Number | Amount applied |
| `type` | `"min"` \| `"max"` \| `"starting"` \| `"regen"` | Which facet of the stat a trait modifies |
| `interval` | String | Stat-update cadence (e.g. `"hour"`), used by `statUpdates` rather than traits |

### 🗂️ `traitGroups`

Optional folders that organize traits in the editor and the trait-selection screen. Nestable via `parentId`.

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier |
| `name` | String | Folder name |
| `playerDescription` | String | Shown to the player in the trait-selection screen |
| `aiDescription` | String | Sent to the AI as a header above this group's selected traits |
| `parentId` | String \| null | null = top-level; otherwise the parent group's `id` |
| `order` | Number | Sibling order among groups sharing the same parent |

### 🗺️ `locations`

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier |
| `name` | String | Display name |
| `playerDescription` | String | Shown to the player in-game |
| `aiDescription` | String | Full description sent to the AI |
| `aiSummary` | String | Short description sent to the AI where the full one is too long |
| `description` | String | Legacy fallback when `playerDescription` is absent |
| `backgroundImage` | String | Data-URL background image |
| `imageTags` | String | Booru tags for AI image generation (editor-only; not sent to the narrative AI) |
| `ambientSound` | [MediaAsset](#-media-fields) | Looping ambient audio |
| `isStarting` | Boolean | A candidate start location. One flagged = every game starts there; several = the player picks between them; none = a random location of any kind |
| `parentId` | String \| null | Parent location `id` for sub-location nesting; null/absent = top-level (editor-only, not sent to the AI) |

### 🔗 `connections`

Travel links the author draws between two locations, by `id` — so renaming a location never breaks one.

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier |
| `from` | String | Location `id` travel departs from |
| `to` | String | Location `id` travel arrives at |
| `twoWay` | Boolean | Travelable both ways. `false` = one-way, `from` → `to` only |
| `aiHint` | String | Optional note on *how* the trip is made ("through the shimmering portal"), shown to the AI as a `— via …` suffix on the destination |

> ⚠️ A Connection between two locations **replaces** the free travel nesting gave that pair. Without one, a location always reaches its parent, its children and its siblings; with one, the Connection's own directions are all the travel there is between them. That's what makes a one-way link between two sub-locations of the same place actually one-way.

### 👥 `entities`

Characters or objects in the world.

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier |
| `name` | String | Display name |
| `aliases` | String[] | Other names this entity answers to. Sent to the AI as "also known as", and matched in the story text to detect that the entity is present — **case-sensitive**, whole-word, plural-aware |
| `type` | String | Optional category label |
| `playerDescription` | String | Shown to the player in-game |
| `aiDescription` | String | Full description sent to the AI |
| `aiSummary` | String | Short description sent to the AI where the full one is too long |
| `images` | String[] | Data-URL portraits. A legacy singular `image` is still read as a one-item fallback |
| `imageTags` | String | Booru tags for AI image generation (editor-only; not sent to the narrative AI) |
| `locations` | String[] | `id`s of the locations this entity belongs to. It is present at **all** of them at once |
| `sound` | [MediaAsset](#-media-fields) | Associated sound |
| `model` | [MediaAsset](#-media-fields) | Associated 3D model |
| `groupId` | String \| null | Parent entity-group `id`; null/absent = ungrouped (editor-only, not sent to the AI) |
| `order` | Number | Sibling order within its group (editor-only) |

### 🔄 `statUpdates`

Rules the AI evaluates during play to change stats.

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier |
| `name` | String | Display name of the rule |
| `prompt` | String | Prompt sent to the AI to evaluate this update |
| `stats` | String[] | Names of the stats this update may change |
| `messageHistory` | Array | Message records for this update |

### 📖 `dictionaries`

A lightweight world-info / lorebook. `dictionaries` is an array of **books**; each book holds an ordered array of `entries`, and an entry is injected into the AI prompt when one of its keywords appears in play.

> 🔄 **Shape change (v2.x).** Older worlds stored a single flat `dictionary` array of entries. That folds into one "Default" book automatically on import (`migrateWorld`), and there's always ≥1 book afterward. Author new worlds against `dictionaries`.

Each **book** (`Dictionary`):

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier |
| `name` | String | Book name |
| `description` | String | Human-facing note (not sent to the AI); round-trips imported lorebook descriptions |
| `enabled` | Boolean | `false` mutes the whole book; absent/`true` = active |
| `entries` | [DictionaryEntry](#dictionary-entries)[] | The book's lore entries |

#### Dictionary entries

Book order sets injection order; within a book, an entry's `position` picks the prompt block and array order sets order within it. Everything below `value` is an optional lorebook control — all absent ⇒ the original plain keyword→value behavior.

> 🔍 **What "scanned" means.** Keywords are matched against the context the AI is actually given that turn — the location and entity blocks your prompt renders (**in their rendered form**, so a block sent as a summary is matched as a summary), player notes, the action, and message history per `scanDepth`. Always-present text is excluded: the world description, stats, traits, and formatting guidance. See [World Editor → Dictionary](WorldEditor#what-gets-scanned).

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier |
| `name` | String | Display label (mirrors `key`) |
| `key` | String | Comma-separated trigger keywords |
| `value` | String | Content injected when a keyword matches |
| `enabled` | Boolean | `false` disables the entry; absent/`true` = active |
| `constant` | Boolean | Always inject, regardless of keyword matches |
| `secondaryKeys` | String | Comma-separated secondary keywords that gate activation alongside a primary hit |
| `secondaryAll` | Boolean | Require ALL secondary keywords rather than any one |
| `secondaryExclude` | Boolean | Invert the secondary test — activate only when they're ABSENT |
| `useRegex` | Boolean | Treat keywords as regular expressions instead of substrings |
| `matchWholeWords` | Boolean | Match on word boundaries (ignored when `useRegex`) |
| `caseSensitive` | Boolean | Match case-sensitively (default: insensitive) |
| `recursive` | Boolean | May be activated by other activated entries' content |
| `position` | `"before"` \| `"after"` | Prompt block: `before` (Background Lore, early) or `after` (Foreground Lore, late — default) |
| `scanDepth` | Number | Cap history lookback to the last N messages (current scene always scanned); absent = all history |
| `priority` | Number | Imported-lorebook drop priority when over budget (higher = kept); stored for round-trip |
| `tokenBudget` | Number | Imported-lorebook token budget; stored for round-trip |
| `extensions` | Object | Unmapped imported-lorebook fields, preserved for lossless re-export |

---

## 🎞️ Media fields

Images (`thumbnail`, `bgm`, location `backgroundImage`, entity `images`) are stored as **base64 data-URL strings**, e.g. `data:image/png;base64,...`.

An image field may instead hold an **`http(s)` URL**, which points at a picture rather than carrying it. The two are told apart by the value's own prefix — there is no separate field — so any image field accepts either form, and a world written before linked images existed reads identically. A reader that doesn't know about links will simply fail to load those pictures; nothing else about the file changes.

Uploaded audio/model assets (`customPlayerVRM`, location `ambientSound`, entity `sound`/`model`) are a **`MediaAsset`** object that pairs the data with its MIME type:

```json
{ "data": "data:model/vrm;base64,...", "type": "model/vrm" }
```

---

## 🧪 Example world

A trimmed example showing the shape (media payloads abbreviated):

```json
{
  "id": "example-world",
  "version": "2.0.3",
  "worldOverview": {
    "name": "Example World",
    "description": "A sample world demonstrating the data format",
    "author": "Documentation Team",
    "thumbnail": "data:image/png;base64,...",
    "bgm": "data:audio/mp3;base64,...",
    "systemPrompt": "A fantasy world of magic and adventure.",
    "use3DModel": true,
    "tags": ["fantasy", "adventure"],
    "customPlayerVRM": { "data": "data:model/vrm;base64,...", "type": "model/vrm" },
    "readme": "# Welcome\nA short intro shown when you enter this world."
  },
  "stats": [
    {
      "id": "health",
      "name": "Health",
      "type": "number",
      "description": "Your physical wellbeing",
      "min": 0,
      "max": 100,
      "starting": 100,
      "regen": 1,
      "descriptors": [
        { "id": "hp-low", "threshold": 30, "description": "You are severely injured" },
        { "id": "hp-high", "threshold": 100, "description": "You are in perfect health" }
      ],
      "code": ""
    }
  ],
  "traits": [
    {
      "id": "strong",
      "name": "Strong",
      "playerDescription": "Above-average physical strength",
      "aiDescription": "This character is unusually strong.",
      "groupId": "physical",
      "statChanges": [{ "statId": "strength", "value": 20, "type": "starting" }]
    }
  ],
  "traitGroups": [
    { "id": "physical", "name": "Physical", "parentId": null, "order": 0 }
  ],
  "locations": [
    {
      "id": "town",
      "name": "Town Square",
      "playerDescription": "The central gathering place",
      "backgroundImage": "data:image/png;base64,...",
      "isStarting": true
    },
    {
      "id": "market",
      "name": "Market",
      "playerDescription": "Stalls line a narrow lane off the square.",
      "parentId": "town"
    }
  ],
  "entities": [
    {
      "id": "shopkeeper",
      "name": "Friendly Shopkeeper",
      "type": "npc",
      "playerDescription": "Sells various goods",
      "locations": ["town"]
    }
  ],
  "statUpdates": [
    {
      "id": "hunger-decay",
      "name": "Hunger Over Time",
      "prompt": "Increase hunger gradually as time passes.",
      "stats": ["Hunger"],
      "messageHistory": []
    }
  ],
  "dictionaries": [
    {
      "id": "book-1",
      "name": "Default",
      "enabled": true,
      "entries": [
        {
          "id": "lore-1",
          "name": "ancient war, the war",
          "key": "ancient war, the war",
          "value": "A centuries-old conflict that shaped the kingdom.",
          "position": "after"
        }
      ]
    }
  ]
}
```
