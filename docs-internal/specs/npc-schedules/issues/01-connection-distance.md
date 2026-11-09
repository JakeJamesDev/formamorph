# 01: Connection Distance

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Owns the Nearby reach helper that tickets 08, 10 and 11 read.

## What to build

An author selects a Connection on the canvas and sets it to Nearby or Far in its inspector. A new or migrated Connection is Nearby. To make an implicit link Far, the author clicks its arrow, which already creates a two-way Connection, then sets Far. Deleting the Connection restores the implicit Nearby link. A Far link still allows travel in every way it does today.

The narrator's nearby list changes with it: the Entities chip's nearby section lists entities in places one Nearby link from the player's place, implicit or Connection, in either direction. Places across a Far link are left out. The Nearby Through Connections checkbox and its field are removed, because Nearby reach already counts Connections.

Only Far is stored on a Connection; absent means Nearby. The value belongs to the pair, both legs.

Spec rulings: Q37–Q39, Q48, Q49, Q61, Q82. Stories 30–34, 58. The spec's "World shape: connections" and "Reach" sections hold the rules.

**Export shape:** the world file gains a Connection distance and loses a location's Nearby Through Connections field. Say so in the landing.

## Acceptance criteria

- [x] A Connection stores Far and nothing for Nearby. Loading a world with the removed location field drops it, and loading twice changes nothing more. (`blankWorld.test.ts` drop + idempotence; `locationCanvas.test.ts` distanceIntent stores nothing for Nearby; `migrateConnectionLegs` keeps `distance`.)
- [x] One Nearby reach helper returns the places one Nearby link from a place: implicit pairs, Connections in either direction, never chained, never across Far. Tests cover each case, and a Far Connection that replaces an implicit pair. (`nearbyPlaces` in `locationGraph.ts`; `locationGraph.test.ts` "nearbyPlaces".)
- [x] Travel is unchanged by distance: the existing travel and destination tests pass untouched, and a new test moves the player across a Far link. (`GameViewer.multiHopMoves.test.tsx` "a Far link" moves the player and a follower; review gates green.)
- [x] The canvas inspector shows the Nearby / Far choice for the selected Connection, and the change is one undo step. (`WorldEditor.connectionDistance.test.tsx`.)
- [x] A Far link draws differently from a Nearby one on the canvas and on the player's Map. (`locationCanvas.test.ts` "a Far Connection"; `LocationMap.test.tsx` dotted vs solid; frames.)
- [x] The Entities chip's nearby section lists an entity one Nearby link away and omits one across a Far link. The guard is proven by reinstating the old rule. (`chipValues.test.ts`; went red with the tree-only rule reinstated and with Far ignored in `nearbyPlaces`.)
- [x] The Nearby Through Connections checkbox is gone from the location editor, with its copy and its help text. (Repo grep finds it only in history docs and the migration.)
- [x] A new ADR extends ADR 0002 with distance. `CONTEXT.md` defines Nearby and Far. The world format doc and the locations wiki page describe the field. (ADR 0016; `WorldFormat.md`; `World-Editor-Locations.md` "Nearby and Far".)
- [x] Copy for the choice is written under the Writing Guide. (Captions verb-first, no period, 10 and 11 words; Standards review passed them.)
- [x] Frames: `.scratch/frames/far-link-canvas.png` and `.scratch/frames/far-link-map.png`, light and dark, at 1440 px wide. (Stored with `-light` and `-dark` suffixes.)

For you: the Far link's look on the canvas and the Map. It is a new visual pattern and needs your approval before this lands. The prototype drew a dotted line with "· Far" on the label.

## Landed

**Not verified**

- None.

**For you**

- For you: the Far link's look on the canvas and the Map. It is a new visual pattern and needs your approval before this lands. The prototype drew a dotted line with "· Far" on the label.
  - Approved from the frames on 2026-11-09: dotted line, with Far moved ahead of the hint ("Far · hint") so a truncated hint never hides it. Frames: `.scratch/npc-schedules-01/frames/far-link-canvas-light.png`, `far-link-canvas-dark.png`, `far-link-map-light.png`, `far-link-map-dark.png`.
- Nearby now counts children and Connection ends for every location. In the Sedge Landing reference world, Tomas on the Far Bank now reaches narration context as nearby. Watch the narrator for over-mentioning neighbors in worlds that had no Nearby Through Connections.
- Formaquestion's player view now keeps a Connection's distance (the Map shows it).
