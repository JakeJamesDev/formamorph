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

Every world saved or exported by Formamorph 2.0+ carries a top-level `version` string (e.g. `"2.0.0"`). On import, worlds that don't match the current version are run through a **migration** that upgrades them to the current shape — so anything reaching the editor is already compatible.

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
| `locations` | Array | Places the player can visit |
| `entities` | Array | Characters/objects the player can interact with |
| `traits` | Array | Selectable characteristics that modify stats |
| `statUpdates` | Array | Rules the AI uses to change stats during play |
| `dictionary` | Array | Lore keywords injected into the AI prompt on match |

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
| `code` | String | Optional JS deriving this stat from others — see the **[Stat Code Guide](StatCodeGuide)** |
| `noIncrease` / `noDecrease` | Boolean | Stop the AI from raising/lowering the current value |
| `noIncreaseMax` / `noDecreaseMax` | Boolean | Stop the AI from raising/lowering the max |

#### Stat descriptors

`descriptors` map value thresholds to flavor text the AI sees:

| Field | Type | Description |
|---|---|---|
| `id` | String \| Number | Unique identifier |
| `threshold` | Number | Value at/under which this descriptor applies |
| `description` | String | Text for the stat at this level |

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
| `description` | String | What the trait does |
| `statChanges` | [StatChange](#stat-changes)[] | How it modifies stats |

#### Stat changes

| Field | Type | Description |
|---|---|---|
| `statId` | String | Target stat's `id` |
| `value` | Number | Amount applied |
| `type` | `"min"` \| `"max"` \| `"starting"` \| `"regen"` | Which facet of the stat the trait modifies |

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
| `ambientSound` | [MediaAsset](#-media-fields) | Looping ambient audio |
| `entities` | String[] | `id`s of entities present here |
| `connections` | String[] | Names of connected locations (shown in the location panel) |
| `isStarting` | Boolean | A candidate start location — one is chosen at random on a new game |

### 👥 `entities`

Characters or objects in the world.

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier |
| `name` | String | Display name |
| `type` | String | Optional category label |
| `playerDescription` | String | Shown to the player in-game |
| `aiDescription` | String | Full description sent to the AI |
| `aiSummary` | String | Short description sent to the AI where the full one is too long |
| `image` | String | Data-URL portrait |
| `sound` | [MediaAsset](#-media-fields) | Associated sound |
| `model` | [MediaAsset](#-media-fields) | Associated 3D model |

### 🔄 `statUpdates`

Rules the AI evaluates during play to change stats.

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier |
| `name` | String | Display name of the rule |
| `prompt` | String | Prompt sent to the AI to evaluate this update |
| `stats` | String[] | Names of the stats this update may change |
| `messageHistory` | Array | Message records for this update |

### 📖 `dictionary`

Lore entries injected into the AI prompt when a keyword appears in play (a lightweight world-info / lorebook).

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier |
| `name` | String | Display label (mirrors `key`) |
| `key` | String | Comma-separated trigger keywords |
| `value` | String | Content injected when a keyword matches |

---

## 🎞️ Media fields

Images (`thumbnail`, `bgm`, location `backgroundImage`, entity `image`) are stored as **base64 data-URL strings**, e.g. `data:image/png;base64,...`.

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
  "version": "2.0.0",
  "worldOverview": {
    "name": "Example World",
    "description": "A sample world demonstrating the data format",
    "author": "Documentation Team",
    "thumbnail": "data:image/png;base64,...",
    "bgm": "data:audio/mp3;base64,...",
    "systemPrompt": "A fantasy world of magic and adventure.",
    "use3DModel": true,
    "tags": ["fantasy", "adventure"],
    "customPlayerVRM": { "data": "data:model/vrm;base64,...", "type": "model/vrm" }
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
      "description": "Above-average physical strength",
      "statChanges": [{ "statId": "strength", "value": 20, "type": "starting" }]
    }
  ],
  "locations": [
    {
      "id": "town",
      "name": "Town Square",
      "playerDescription": "The central gathering place",
      "backgroundImage": "data:image/png;base64,...",
      "entities": ["shopkeeper"],
      "connections": ["Market", "Tavern"],
      "isStarting": true
    }
  ],
  "entities": [
    {
      "id": "shopkeeper",
      "name": "Friendly Shopkeeper",
      "type": "npc",
      "playerDescription": "Sells various goods"
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
  "dictionary": [
    {
      "id": "lore-1",
      "name": "ancient war, the war",
      "key": "ancient war, the war",
      "value": "A centuries-old conflict that shaped the kingdom."
    }
  ]
}
```
