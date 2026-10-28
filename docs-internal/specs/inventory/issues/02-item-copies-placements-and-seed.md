# 02: Item Copies, Placements And Seed

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a save export-shape change, a new pure module seam, and load-time cleanup across saves.

## What to build

Authors place starting items. A location, each entity and the persona get a placements section: item, quantity and Hidden. When a new game starts, the seed turns placements into Item Copies in the save. The seed is the only reader of placements (Q44), and it runs for a new game only (Q59). `you` resolves to the played Persona, so a played world entity's placements are the player's (Q54).

This ticket owns the Item Copy type (id, item or runtime item id, a tagged-union location `you` / `entity` / `location`, quantity, equipped slot and equip order, a visibility enum, per-copy state) and the pure Inventory module's skeleton, its injected id maker, and the owner query helper that 03, 08 and 10 read through. On load, Item Copies whose item, owner entity or location no longer exists are dropped with a diagnostic (Q60; 04 adds the effect reversal). The Sandbox Snapshot and the Test Bench's turn-one snapshot carry seeded Item Copies. Inventory state lives in `GameState`, so a re-roll restores it.

Spec: Q2, Q3, Q35, Q44, Q45 hooks 1–3 and 7, Q54, Q59, Q60, Q68, Q69; stories 46–53, 93, 94.

## Acceptance criteria

- [x] Placements edit on locations, entities and the persona, and round-trip through world export — `WorldEditor.placements.test.tsx` (Persona Items, entity and location Items tabs, read back through `getWorldData`); a live check of the Persona Items row on `#dev?modal=worldEditor&tab=overview&fixture=items`
- [x] A new game holds the seeded Item Copies; a stackable item placed twice on one owner forms one stack, a hidden placement stays a separate hidden row — `GameViewer.itemSeed.test.tsx` "a new game"; `inventory.test.ts` stack case (mutation-tested)
- [x] Loading an older save never adds Item Copies from new placements — `GameViewer.itemSeed.test.tsx` "gains no Item Copies…" (mutation-tested: seeding after load turns it red)
- [x] An Item Copy of a deleted item, entity or location is dropped on load with a diagnostic — `GameplayContext.itemCopies.test.tsx` (state and history, one system log line); `GameViewer.itemSeed.test.tsx` through the real load path
- [x] A played world entity's placements land on the `you` owner — `inventory.test.ts`, `openingState.test.ts`, `GameViewer.itemSeed.test.tsx` (mutation-tested)
- [x] Item Copies round-trip through save export and import; a re-roll restores the turn's starting inventory — `GameplayContext.itemCopies.test.tsx` JSON round trip and snapshot restore (the full re-roll path, `loadGameState`)
- [x] Sandbox Snapshot and Test Bench snapshots include seeded Item Copies — `openingState.test.ts` carry case; the Bench, Test Code and the sample Tool snapshot all build on `openingStateOf`
- [x] The seed and the owner query helper are tested through the module entry; a guard test fails when the seed backfills an older save — `src/lib/inventory/inventory.test.ts` (100% of the module; six mutations each red); guard as above
- [x] Changelog fragment written — `docs-internal/changelog.d/inventory-02.md`; docs in `docs/World-Editor-Items.md` → Starting Items

## Blocked by

- 01

## Landed

**Not verified**

- All criteria verified. Review notes for later tickets:
  - The play-time `SandboxState` (GameViewer's stat-code run) does not carry `itemCopies` yet. Ticket 11 wires it when scripts read inventory.
  - `discardUnpairedUserTurn` and the stats-only re-roll do not reset Item Copies: nothing writes them mid-turn in 02. Ticket 11 (before-box script writes) and 09 (the pass) need to restore them there.
  - Item Copy ids come from `openingFold`'s injected maker (`randomUUID` by default), so the fold is pure except for chip rolls and those ids.

**For you**

- Open a world, add Persona Items on the Overview, and Items on an entity and a location. Start a new game and check the player starts with them. (`#dev?modal=worldEditor&tab=overview&fixture=items`)
- The Overview section is **Persona Items**; the entity and location tabs say **Starting Items** (Q81, Q83).
