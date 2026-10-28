# 02: Item Copies, Placements And Seed

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a save export-shape change, a new pure module seam, and load-time cleanup across saves.

## What to build

Authors place starting items. A location, each entity and the persona get a placements section: item, quantity and Hidden. When a new game starts, the seed turns placements into Item Copies in the save. The seed is the only reader of placements (Q44), and it runs for a new game only (Q59). `you` resolves to the played Persona, so a played world entity's placements are the player's (Q54).

This ticket owns the Item Copy type (id, item or runtime item id, a tagged-union location `you` / `entity` / `location`, quantity, equipped slot and equip order, a visibility enum, per-copy state) and the pure Inventory module's skeleton, its injected id maker, and the owner query helper that 03, 08 and 10 read through. On load, Item Copies whose item, owner entity or location no longer exists are dropped with a diagnostic (Q60; 04 adds the effect reversal). The Sandbox Snapshot and the Test Bench's turn-one snapshot carry seeded Item Copies. Inventory state lives in `GameState`, so a re-roll restores it.

Spec: Q2, Q3, Q35, Q44, Q45 hooks 1–3 and 7, Q54, Q59, Q60, Q68, Q69; stories 46–53, 93, 94.

## Acceptance criteria

- [ ] Placements edit on locations, entities and the persona, and round-trip through world export
- [ ] A new game holds the seeded Item Copies; a stackable item placed twice on one owner forms one stack, a hidden placement stays a separate hidden row
- [ ] Loading an older save never adds Item Copies from new placements
- [ ] An Item Copy of a deleted item, entity or location is dropped on load with a diagnostic
- [ ] A played world entity's placements land on the `you` owner
- [ ] Item Copies round-trip through save export and import; a re-roll restores the turn's starting inventory
- [ ] Sandbox Snapshot and Test Bench snapshots include seeded Item Copies
- [ ] The seed and the owner query helper are tested through the module entry; a guard test fails when the seed backfills an older save
- [ ] Changelog fragment written

## Blocked by

- 01
