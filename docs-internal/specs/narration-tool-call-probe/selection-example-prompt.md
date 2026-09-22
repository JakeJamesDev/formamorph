# Exact selection experiment prompts

[Protocol](selection-example-protocol.md)

The initial request is identical in all arms, and its saved response is reused. On subsequent requests, A retains the real scene's prior reasoning; B omits it; C omits it and inserts the authored demonstration below after the system message and before the current user action. C preserves the demonstration's reasoning. Outgoing tool-call IDs are remapped consistently to nine-character IDs. Quiet cases never reach a follow-up and receive no demonstration.

## Shared system prompt

````text
You are the narrator of an interactive story. Narrate what happens in response to the player's action in second person, present tense.

## Game World
The setting, tone, and world-wide facts of this story.

The tone is a quiet, grounded folk tale: hushed and observational, with small human moments rather than grand adventure. Iron rusts to a pale blue, never orange. No one speaks their own name aloud until they trust you.



## Player Stats
Descriptions of the player character's current stat values.

- **Vigor:** Winded
- **Resolve:** Unshakable

## Traits
The player character's active characteristics and conditions.

- **Wren the Mapmaker:** The player character is Wren, a traveling mapmaker with close-cropped silver hair and ink-stained hands, missing the last two fingers of the left hand. Wren is soft-spoken and observant, cannot swim, and habitually ties a small "tollow-knot" in any loose rope for luck.
- **Condition:**
  - **Footsore:** Wren is footsore and travel-worn, slow to rise and quick to tire.



## Current Location
The place where the player character currently is.

- **name:** Sedge Landing
- **description:** A rickety wooden dock on the north bank of the Ashen River. The water here runs milk-pale and dead silent - locals call this stretch the gloamwater. A single lantern hangs from a leaning post where notices are nailed; a rope ferry is moored at the dock, its far end lost in mist. The Ashen River is a slow northern waterway crossed only by rope ferry.






## Entities in the Current Location
An entity is a character, creature, or object listed in the entity summaries.
These summaries identify entities that may appear in the current location.

- **Bram**
  - **summary:** The one-armed ferryman who won't cross after dark.
  - **type:** Person
- **Odette**
  - **summary:** The scarred eel-smoker waiting to cross; distrusts strangers.
  - **type:** Person
- **Rope Ferry**
  - **summary:** A two-person rope raft that lists to the left.
  - **type:** Object
- **Mara**
  - **summary:** A traveling healer sorting clean bandages beside a chest at the landing.
  - **type:** Person
- **Iven**
  - **summary:** A cobbler repairing travelers' footwear on a low stool at the landing.
  - **type:** Person
- **Nessa**
  - **summary:** A basketmaker counting empty reed baskets near the path.
  - **type:** Person
- **Corin**
  - **summary:** A courier waiting at the landing with a sealed satchel.
  - **type:** Person






## Foreground Lore
Additional authored information about the world, its concepts, and its terminology.

gloamwater: Gloamwater: a stretch of river gone silent and milk-pale where the current stalls. Sound does not carry over it and fish avoid it; folk say names spoken over gloamwater are forgotten by morning.
````

## A — Original reasoning replayed tool schema

````json
[
  {
    "type": "function",
    "function": {
      "name": "get_entity",
      "description": "Purpose: Retrieve an entity's full authored entry. Entity summaries identify candidates for the story.\nUse when: Before an entity appears in your upcoming narration, retrieve its full entry for this response. This includes named, indirect, and background appearances.\nInput: name — the entity's name from the entity list.\nOutput: JSON with a matches array. Each match contains id, name, and the full authored description when provided by the author. An empty matches array means no matching entity was found.",
      "parameters": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          }
        },
        "required": [
          "name"
        ],
        "additionalProperties": false
      }
    }
  }
]
````

## B — No prior reasoning tool schema

````json
[
  {
    "type": "function",
    "function": {
      "name": "get_entity",
      "description": "Purpose: Retrieve an entity's full authored entry. Entity summaries identify candidates for the story.\nUse when: Before an entity appears in your upcoming narration, retrieve its full entry for this response. This includes named, indirect, and background appearances.\nInput: name — the entity's name from the entity list.\nOutput: JSON with a matches array. Each match contains id, name, and the full authored description when provided by the author. An empty matches array means no matching entity was found.",
      "parameters": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          }
        },
        "required": [
          "name"
        ],
        "additionalProperties": false
      }
    }
  }
]
````

## C — Demonstrated pattern tool schema

````json
[
  {
    "type": "function",
    "function": {
      "name": "get_entity",
      "description": "Purpose: Retrieve an entity's full authored entry. Entity summaries identify candidates for the story.\nUse when: Before an entity appears in your upcoming narration, retrieve its full entry for this response. This includes named, indirect, and background appearances.\nInput: name — the entity's name from the entity list.\nOutput: JSON with a matches array. Each match contains id, name, and the full authored description when provided by the author. An empty matches array means no matching entity was found.",
      "parameters": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          }
        },
        "required": [
          "name"
        ],
        "additionalProperties": false
      }
    }
  }
]
````

## Authored demonstration inserted before the current user on C follow-ups

````json
[
  {
    "role": "user",
    "content": "Demonstration from a separate story. Location: an observatory archive. Entity summary: Ysra, the archivist responsible for a sealed star atlas. Player action: I ask the archivist whether I may examine the atlas."
  },
  {
    "role": "assistant",
    "content": "",
    "reasoning_content": "The request concerns Ysra; retrieve her entry.",
    "tool_calls": [
      {
        "id": "example-ysra",
        "type": "function",
        "function": {
          "name": "get_entity",
          "arguments": "{\"name\":\"Ysra\"}"
        }
      }
    ]
  },
  {
    "role": "tool",
    "tool_call_id": "example-ysra",
    "content": "{\"matches\":[{\"id\":\"example-ysra\",\"name\":\"Ysra\",\"description\":\"Ysra wears indigo cuffs and keeps the atlas locked. She permits visitors to examine it only while she supervises. She speaks politely and precisely.\"}]}"
  },
  {
    "role": "assistant",
    "reasoning_content": "Ysra permits access only under supervision, so her answer should offer a supervised viewing.",
    "content": "The archivist rests her indigo cuffs beside the locked atlas. \"You may examine it here, while I attend you,\" she says. She unlocks the cover and makes room at the desk for you to look."
  }
]
````

## User message — greeting

````text
I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.
````

## User message — odette

````text
I approach the woman smoking eels and quietly study her face and hair while asking how she prepares the fish.
````

## User message — ferry

````text
I examine the rope ferry closely, checking its construction and how many people it can carry.
````

## User message — environment

````text
I keep my attention on the pale water and the dock planks, silently studying their colors and textures without interacting with anyone.
````

## User message — healer

````text
A small fresh cut on my palm is stinging. I look for someone at the landing who can dress it, approach them, and ask for help.
````

## User message — cobbler

````text
The sole of my boot has come loose. I look for someone at the landing who can repair it, approach them, and ask what can be done.
````
