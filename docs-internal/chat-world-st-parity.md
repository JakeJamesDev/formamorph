# Chat World — SillyTavern Parity Research

**Status: PARKED (2026-08-05).** Prerequisite features must land first — starting with a per-world custom narration prompt. Resume here when circling back.

## The idea

A new default world whose only purpose is chatting with entities imported into the main-menu library — Formamorph's SillyTavern equivalent. **The entity carries the lore; the world exists to set up the system prompt so the card can be built upon.** Load an entity + dictionary and it should feel close to ST. Alongside it: the first default *entity* (human female) designed to fit that world. Both generically SFW without imposing restrictions.

Related plumbing that already exists:

- The character-selection step ([CharacterSelectionModal.tsx](../src/views/CharacterSelectionModal.tsx)) already copies library entities into any playthrough's starting location as runtime entities.
- Default worlds seed from [defaultworlds](../src/defaultworlds) via [defaultWorlds.ts](../src/lib/defaultWorlds.ts) with delete-tombstones. A seeded default **entity** would be new machinery — a parallel seeder for the entity library.
- Card import ([tavernCard.ts](../src/lib/tavernCard.ts)) and lorebook import already exist; see the mapping below for what they keep/drop.

## How SillyTavern composes its prompt

Fetched live 2026-08-05 from the SillyTavern docs (`SillyTavern/SillyTavern-Docs`, branch `main`) and app source (`SillyTavern/SillyTavern`, branch `release`). Key sources:

- https://docs.sillytavern.app/usage/core-concepts/characterdesign/ (card fields)
- https://raw.githubusercontent.com/SillyTavern/SillyTavern-Docs/main/Usage/Prompts/context-template.md (story string)
- https://raw.githubusercontent.com/SillyTavern/SillyTavern-Docs/main/Usage/Prompts/prompt-manager.md (chat completion order)
- https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/default/content/presets/openai/Default.json (shipped defaults)

### Composition order

**Text completion (story string):** anchorBefore → system → wiBefore → description → personality → scenario → wiAfter → persona → anchorAfter, then example messages, then chat history. Post-history instructions ride as an invisible user-role injection before the last line.

**Chat completion (prompt manager default):** main → worldInfoBefore → personaDescription → charDescription → charPersonality → scenario → (enhanceDefinitions, off) → auxiliary → worldInfoAfter → dialogueExamples → chatHistory → postHistoryInstructions.

### Facts that shape our design

| ST piece | Behavior |
|---|---|
| Main prompt | The entire default is one line: *"Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}."* All heavy lifting comes from the card. |
| First message (`first_mes`) | The **character's** authored opening message; enters chat history (assistant side) and scrolls out naturally. Docs: the model picks up style and length from it "more than anything else." Alternate greetings = swipes. |
| Example dialogue (`mes_example`) | `<START>`-separated blocks with `{{user}}:`/`{{char}}:` lines. Inserted only while context has room; **evicted block-by-block** as history grows (optionally pinned). |
| Persona | User's name (`{{user}}`) + description (`{{persona}}`), default position in the story string / pinned prompt; can also inject in-chat at depth. |
| Character's Note (`depth_prompt`) | Per-card in-chat injection, default depth 4, role system — trait reinforcement near the recency slot. |
| Author's Note | Per-chat injection, default in-chat depth 4, every user input. |
| Card prompt overrides | Cards may override the main prompt / post-history instructions (gated on user settings, `{{original}}` splices the default). |
| Not prompt-relevant | Creator notes, version, embedded tags, talkativeness (group-chat reply odds), favorite. |

## Mapping to Formamorph

| ST slot | Formamorph home | Status |
|---|---|---|
| Main prompt | World `systemPrompt` → the `## Game World` section of every AI call ([GameViewer.tsx:1380](../src/views/GameViewer.tsx:1380)) — augments the fixed narrator frame, never replaces it | The chat world's main lever |
| description+personality+scenario | Folded into `aiDescription` on import ([tavernCard.ts:56](../src/lib/tavernCard.ts:56)) | ✅ |
| World info before/after | Dictionaries, `position: 'before' \| 'after'` | ✅ |
| **First message** | **Dropped on import**; our opening is generated from `OPENING_SCENE_CUE` | ❌ biggest gap |
| **Example dialogue** | **Dropped on import** | ❌ gap |
| Persona | Player Notes (`<NOTES>` rides every prompt) + traits — nothing guides players to use them this way | 🔶 |
| Author's/Character's Note | OOC `[bracket]` channel + Player Notes; no depth injection | 🔶 |
| Card prompt overrides | Dropped | OK — our narrator frame is the product |

### Structural differences

1. **Voice.** ST is first-person character-speaks-to-you chat. Formamorph is a second-person narrator + separate choices step. A world's `systemPrompt` can steer narration hard toward dialogue but cannot remove the narrator — which is why a **per-world narration prompt** became the identified prerequisite.
2. **Scenario ownership.** In ST the card carries the scenario. Authored locations risk fighting the card's scenario, pushing toward thin/neutral locations.

## Open decisions (interview never completed)

- Greeting: fold `first_mes` into `aiDescription` vs a real `Entity.greeting` field (**export-shape change**) + opening-flow support vs keep dropping.
- Example dialogue: fold into `aiDescription` vs real field vs keep dropping.
- How dialogue-first the chat world's prompt should push (given the narrator can't be removed — may be moot once per-world narration prompts exist).
- Locations: thin neutral stages vs lightly flavored "conversation catalysts" vs a single anywhere-room.
- World frame/premise, stats (likely zero), entity authoring approach — round-one questions, all unanswered.
- Default-entity seeding machinery (parallel to `DEFAULT_WORLDS`, with tombstones).

## Prerequisites before the world is buildable

1. **Per-world custom narration prompt** — speced, see `world-narration-prompt-spec.md`.
2. Likely: greeting/example-dialogue import decisions above.
3. Possibly: persona guidance (surfacing Player Notes as the {{persona}} equivalent).
