# World Data Format Documentation

This document details the format of world data and world preview information used in Exotic Dangerous for displaying worlds in the main menu and managing world data.

## Overview

Exotic Dangerous uses a structured JSON format to define worlds, which includes various components such as world overview information, stats, locations, entities, traits, and stat updates. This document provides a comprehensive reference for understanding and creating compatible world data files.

## World Storage

Worlds are stored in the browser's IndexedDB with the following structure:

- **Database Name**: `worldsDB`
- **Store Name**: `worlds`
- **Key Path**: `id`

## World Metadata Structure

World metadata is used for displaying world previews in the main menu. Each world has the following metadata properties:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the world |
| `name` | String | Display name of the world |
| `description` | String | Brief description of the world |
| `author` | String | Creator of the world |
| `thumbnail` | String | Base64-encoded image data for the world thumbnail |
| `createdAt` | String | ISO timestamp of when the world was created |
| `lastAccessed` | String | ISO timestamp of when the world was last accessed |

## Complete World Data Structure

A complete world data object contains the following top-level properties:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the world |
| `worldOverview` | Object | General information about the world |
| `stats` | Array | Collection of stats that define the game mechanics |
| `locations` | Array | Places the player can visit in the world |
| `entities` | Array | Characters or objects the player can interact with |
| `traits` | Array | Special characteristics the player can select |
| `statUpdates` | Array | Rules for how stats change over time or based on conditions |

### World Overview Structure

The `worldOverview` object contains general information about the world:

| Property | Type | Description |
|----------|------|-------------|
| `name` | String | Display name of the world |
| `description` | String | Detailed description of the world |
| `author` | String | Creator of the world |
| `thumbnail` | String | Base64-encoded image data for the world thumbnail |
| `bgm` | String | Base64-encoded audio data for background music |
| `systemPrompt` | String | Additional context provided to the AI about the world |
| `use3DModel` | Boolean | Whether the world supports 3D character models |

### Stats Structure

Each stat in the `stats` array defines a game mechanic that can be tracked:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the stat |
| `name` | String | Display name of the stat |
| `description` | String | Description of what the stat represents |
| `min` | Number | Minimum possible value |
| `max` | Number | Maximum possible value |
| `starting` | Number | Initial value when game starts |
| `regen` | Number | How much the stat regenerates per time unit |
| `descriptors` | Array | Thresholds and descriptions for different stat levels |
| `code` | String | Optional custom code for special stat behavior |

#### Stat Descriptors

Each descriptor in the `descriptors` array defines how to describe the stat at different levels:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String/Number | Unique identifier for the descriptor |
| `threshold` | Number | The value at which this descriptor applies |
| `description` | String | Text description for when the stat is at this level |

### Traits Structure

Each trait in the `traits` array defines a characteristic that can modify stats:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the trait |
| `name` | String | Display name of the trait |
| `description` | String | Description of what the trait does |
| `statChanges` | Array | How this trait affects different stats |

#### Stat Changes

Each stat change in the `statChanges` array defines how a trait modifies a stat:

| Property | Type | Description |
|----------|------|-------------|
| `statId` | String | ID of the stat being modified |
| `value` | Number | Amount by which the stat is modified |
| `type` | String | Type of modification: "min", "max", "starting", or "regen" |

### Locations Structure

Each location in the `locations` array defines a place the player can visit:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the location |
| `name` | String | Display name of the location |
| `description` | String | Description of the location |
| `image` | String | Base64-encoded image data for the location |

### Entities Structure

Each entity in the `entities` array defines a character or object the player can interact with:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the entity |
| `name` | String | Display name of the entity |
| `description` | String | Description of the entity |
| `image` | String | Base64-encoded image data for the entity |

### Stat Updates Structure

Each stat update in the `statUpdates` array defines a rule for how stats change:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the stat update |
| `name` | String | Display name of the stat update rule |
| `description` | String | Description of when/how the update occurs |
| `statChanges` | Array | Which stats are affected and by how much |
| `messageHistory` | Array | Record of messages related to this update |

## Example World Data Structure

```json
{
  "id": "example-world",
  "worldOverview": {
    "name": "Example World",
    "description": "A sample world to demonstrate the data format",
    "author": "Documentation Team",
    "thumbnail": "data:image/png;base64,...",
    "bgm": "data:audio/mp3;base64,...",
    "systemPrompt": "This is a fantasy world with magic and adventure.",
    "use3DModel": true
  },
  "stats": [
    {
      "id": "health",
      "name": "Health",
      "description": "Your physical wellbeing",
      "min": 0,
      "max": 100,
      "starting": 100,
      "regen": 1,
      "descriptors": [
        {
          "id": "health-low",
          "threshold": 30,
          "description": "You are severely injured"
        },
        {
          "id": "health-med",
          "threshold": 70,
          "description": "You have some injuries"
        },
        {
          "id": "health-high",
          "threshold": 100,
          "description": "You are in perfect health"
        }
      ],
      "code": ""
    }
  ],
  "traits": [
    {
      "id": "strong",
      "name": "Strong",
      "description": "You have above-average physical strength",
      "statChanges": [
        {
          "statId": "strength",
          "value": 20,
          "type": "starting"
        }
      ]
    }
  ],
  "locations": [
    {
      "id": "town",
      "name": "Town Square",
      "description": "The central gathering place",
      "image": "data:image/png;base64,..."
    }
  ],
  "entities": [
    {
      "id": "shopkeeper",
      "name": "Friendly Shopkeeper",
      "description": "Sells various goods",
      "image": "data:image/png;base64,..."
    }
  ],
  "statUpdates": [
    {
      "id": "hunger-decay",
      "name": "Hunger Over Time",
      "description": "Your hunger increases gradually",
      "statChanges": [
        {
          "statId": "hunger",
          "value": 5,
          "interval": "hour"
        }
      ],
      "messageHistory": []
    }
  ]
}# World Data Format Documentation

This document details the format of world data and world preview information used in Exotic Dangerous for displaying worlds in the main menu and managing world data.

## Overview

Exotic Dangerous uses a structured JSON format to define worlds, which includes various components such as world overview information, stats, locations, entities, traits, and stat updates. This document provides a comprehensive reference for understanding and creating compatible world data files.

## World Storage

Worlds are stored in the browser's IndexedDB with the following structure:

- **Database Name**: `worldsDB`
- **Store Name**: `worlds`
- **Key Path**: `id`

## World Metadata Structure

World metadata is used for displaying world previews in the main menu. Each world has the following metadata properties:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the world |
| `name` | String | Display name of the world |
| `description` | String | Brief description of the world |
| `author` | String | Creator of the world |
| `thumbnail` | String | Base64-encoded image data for the world thumbnail |
| `createdAt` | String | ISO timestamp of when the world was created |
| `lastAccessed` | String | ISO timestamp of when the world was last accessed |

## Complete World Data Structure

A complete world data object contains the following top-level properties:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the world |
| `worldOverview` | Object | General information about the world |
| `stats` | Array | Collection of stats that define the game mechanics |
| `locations` | Array | Places the player can visit in the world |
| `entities` | Array | Characters or objects the player can interact with |
| `traits` | Array | Special characteristics the player can select |
| `statUpdates` | Array | Rules for how stats change over time or based on conditions |

### World Overview Structure

The `worldOverview` object contains general information about the world:

| Property | Type | Description |
|----------|------|-------------|
| `name` | String | Display name of the world |
| `description` | String | Detailed description of the world |
| `author` | String | Creator of the world |
| `thumbnail` | String | Base64-encoded image data for the world thumbnail |
| `bgm` | String | Base64-encoded audio data for background music |
| `systemPrompt` | String | Additional context provided to the AI about the world |
| `use3DModel` | Boolean | Whether the world supports 3D character models |

### Stats Structure

Each stat in the `stats` array defines a game mechanic that can be tracked:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the stat |
| `name` | String | Display name of the stat |
| `description` | String | Description of what the stat represents |
| `min` | Number | Minimum possible value |
| `max` | Number | Maximum possible value |
| `starting` | Number | Initial value when game starts |
| `regen` | Number | How much the stat regenerates per time unit |
| `descriptors` | Array | Thresholds and descriptions for different stat levels |
| `code` | String | Optional custom code for special stat behavior |

#### Stat Descriptors

Each descriptor in the `descriptors` array defines how to describe the stat at different levels:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String/Number | Unique identifier for the descriptor |
| `threshold` | Number | The value at which this descriptor applies |
| `description` | String | Text description for when the stat is at this level |

### Traits Structure

Each trait in the `traits` array defines a characteristic that can modify stats:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the trait |
| `name` | String | Display name of the trait |
| `description` | String | Description of what the trait does |
| `statChanges` | Array | How this trait affects different stats |

#### Stat Changes

Each stat change in the `statChanges` array defines how a trait modifies a stat:

| Property | Type | Description |
|----------|------|-------------|
| `statId` | String | ID of the stat being modified |
| `value` | Number | Amount by which the stat is modified |
| `type` | String | Type of modification: "min", "max", "starting", or "regen" |

### Locations Structure

Each location in the `locations` array defines a place the player can visit:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the location |
| `name` | String | Display name of the location |
| `description` | String | Description of the location |
| `image` | String | Base64-encoded image data for the location |

### Entities Structure

Each entity in the `entities` array defines a character or object the player can interact with:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the entity |
| `name` | String | Display name of the entity |
| `description` | String | Description of the entity |
| `image` | String | Base64-encoded image data for the entity |

### Stat Updates Structure

Each stat update in the `statUpdates` array defines a rule for how stats change:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for the stat update |
| `name` | String | Display name of the stat update rule |
| `description` | String | Description of when/how the update occurs |
| `statChanges` | Array | Which stats are affected and by how much |
| `messageHistory` | Array | Record of messages related to this update |

## Example World Data Structure

```json
{
  "id": "example-world",
  "worldOverview": {
    "name": "Example World",
    "description": "A sample world to demonstrate the data format",
    "author": "Documentation Team",
    "thumbnail": "data:image/png;base64,...",
    "bgm": "data:audio/mp3;base64,...",
    "systemPrompt": "This is a fantasy world with magic and adventure.",
    "use3DModel": true
  },
  "stats": [
    {
      "id": "health",
      "name": "Health",
      "description": "Your physical wellbeing",
      "min": 0,
      "max": 100,
      "starting": 100,
      "regen": 1,
      "descriptors": [
        {
          "id": "health-low",
          "threshold": 30,
          "description": "You are severely injured"
        },
        {
          "id": "health-med",
          "threshold": 70,
          "description": "You have some injuries"
        },
        {
          "id": "health-high",
          "threshold": 100,
          "description": "You are in perfect health"
        }
      ],
      "code": ""
    }
  ],
  "traits": [
    {
      "id": "strong",
      "name": "Strong",
      "description": "You have above-average physical strength",
      "statChanges": [
        {
          "statId": "strength",
          "value": 20,
          "type": "starting"
        }
      ]
    }
  ],
  "locations": [
    {
      "id": "town",
      "name": "Town Square",
      "description": "The central gathering place",
      "image": "data:image/png;base64,..."
    }
  ],
  "entities": [
    {
      "id": "shopkeeper",
      "name": "Friendly Shopkeeper",
      "description": "Sells various goods",
      "image": "data:image/png;base64,..."
    }
  ],
  "statUpdates": [
    {
      "id": "hunger-decay",
      "name": "Hunger Over Time",
      "description": "Your hunger increases gradually",
      "statChanges": [
        {
          "statId": "hunger",
          "value": 5,
          "interval": "hour"
        }
      ],
      "messageHistory": []
    }
  ]
}