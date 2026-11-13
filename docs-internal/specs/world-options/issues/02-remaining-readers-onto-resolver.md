# 02: Remaining Readers Onto The Resolver

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

Every remaining in-play reader of entities and locations reads the In-Play World resolver instead of the raw world. After this ticket, an entity or location the resolver marks off cannot reach the player or the AI by any path.

- Readers: the script `entities` and `locations` globals, World Tools snapshots, the Formaquestion Player View, Test Bench (opening, lens, AI context), mention detection, scene image tags, the inventory pass, following, placeholder pins, relationships, and the player's List and Map.
- Extend ticket 01's parity harness to each reader.
- Editor surfaces keep reading the raw world. So does the save-load item-copy orphan check: a disabled entity's copies are not orphans and must never be deleted (01's landing note).
- 01 left these on the authored world: scripts, pins, the library, and `getWorldData` readers. They are in scope here.
- No changelog fragment: no player-visible change.

Spec rulings: Implementation Decisions (In-Play World resolver), Testing Decisions (reader coverage).

## Acceptance criteria

- [x] The parity harness covers every reader listed above, and with one entity and one location forced off, none of them shows either. Behavior cases in `GameViewer.inPlayWorld.test.tsx` (script globals for entities, locations and runtime characters; placeholder pins), `aiContext.test.ts` (Test Bench AI context), `playerView.test.ts` (Player View runtime characters), each beside an on twin. Mention detection, scene image tags, the inventory pass, following, relationships, World Tools snapshots, the List and the Map read the gated `entities`, `allEntities`, `locations` and `liveScene` that 01 built; `personaReaders.test.ts` pins that wiring by source scan, and 01's cases cover the cast and the router.
- [x] The guard bites: routing any one listed reader back to the raw world turns its case red. Mutated four: the script and pin cast (`codeEntities.world` raw), pins (`ownerPins` on the raw list), the script's runtime characters, and the Test Bench world gate. Each turned its case red.
- [x] A search of in-play code for direct reads of the world's entity and location lists finds only the resolver and editor code; the ticket lists any exception with its reason. Exceptions are in the Landed section.

## Landed

**Not verified**

- The Test Bench hook, the Player View call and the persona picker are pinned by source scan plus a behavior test of the function they call; no test mounts them with a gate off.
- Code Pins carry no owner (they key by placeholder id), so an off entity's script-set Code Pin still applies. Only its trait pins are filtered. Ticket 07 (inertness) owns its scripts.
- Mention detection, scene image tags, the inventory pass, following, relationships, List and Map were not changed: they already read 01's gated lists. No new case for each.

**Exceptions: reads that stay on the authored world**

- `loadGame(…, authoredEntities, …)` in GameViewer: the item-copy orphan check must not delete a disabled entity's copies.
- `openingFold(getWorldData(), …)` at new game: stats and starting traits seed the save for the day an entity turns on.
- `PlaceholderSessionContext` roll priming: rolls must not depend on gates.
- `knownDiscoveredNames` (GameViewer): a hidden runtime character's name still counts as known, so discovery does not mint it again.
- `liveStandings` runtime positions and `usePlayAvatars`: lookups by id of entities the gated lists hand over.
- Pin location lookup (`pinsFor`): the current location keeps its pins while the player stands in it (Q10).
- Test Bench rule pass, lens picker and editor checks read the whole authored world (Q25).

**For you**

- Nothing to judge: no player-visible change.
