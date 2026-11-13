# 02: Remaining Readers Onto The Resolver

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

Every remaining in-play reader of entities and locations reads the In-Play World resolver instead of the raw world. After this ticket, an entity or location the resolver marks off cannot reach the player or the AI by any path.

- Readers: the script `entities` and `locations` globals, World Tools snapshots, the Formaquestion Player View, Test Bench (opening, lens, AI context), mention detection, scene image tags, the inventory pass, following, placeholder pins, relationships, and the player's List and Map.
- Extend ticket 01's parity harness to each reader.
- Editor surfaces keep reading the raw world.
- No changelog fragment: no player-visible change.

Spec rulings: Implementation Decisions (In-Play World resolver), Testing Decisions (reader coverage).

## Acceptance criteria

- [ ] The parity harness covers every reader listed above, and with one entity and one location forced off, none of them shows either.
- [ ] The guard bites: routing any one listed reader back to the raw world turns its case red.
- [ ] A search of in-play code for direct reads of the world's entity and location lists finds only the resolver and editor code; the ticket lists any exception with its reason.
