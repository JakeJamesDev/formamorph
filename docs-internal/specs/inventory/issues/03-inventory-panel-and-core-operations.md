# 03: Inventory Panel And Core Operations

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the one validator every writer uses, plus a new visual pattern that needs the user's approval before it is built.

## What to build

The player gets an **Inventory** game panel tab: slots with their equipped items, then carried items. Buttons: Equip, Unequip, Drop and Give. Each calls the Inventory module's operation entry with the source `panel` and applies at once (Q17). All buttons are off while a turn runs (Q61).

The entry is the one validator (Q45 hook 4). This ticket builds its core: gain, lose, transfer, equip and unequip; slot existence, capacity, slot size and swap-out of the item equipped longest (Q14); splitting one Item Copy off a stack on equip (Q65); presence after this turn's moves (Q62); Bound blocks the panel only (Q58); an invalid operation is skipped with a diagnostic while valid ones apply (Q22). Give lists present entities only. Drop leaves the Item Copy lying at the current location.

Before building, show the panel layout to the user through the `design-system` flow: it is a new visual pattern.

Spec: Q14, Q17, Q20, Q21, Q22, Q43, Q58, Q61, Q62, Q65; stories 29, 30, 44, 73–78, 83.

## Acceptance criteria

- [x] The user approved the panel layout before it was built: approved 2026-10-28 from proposal frames, with one change (side panel tabs show icons alone when labels would overlap); recorded in the Design System's Inventory Tab section
- [x] Equip, Unequip, Drop and Give change the inventory at once and are off while a turn runs: `GamePanels.inventory.test.tsx` (equip, unequip, give, drop cases; "turns every button off while a turn runs"; "closes an open Give popover when a turn starts")
- [x] Equipping into a full slot unequips the item equipped there longest; a size-2 item takes two capacity: `inventory.test.ts` "swaps out the item equipped there longest", "unequips the longest equipped first until a size-2 item fits"
- [x] Equipping from a stack of five leaves four in the stack: `inventory.test.ts` and `GamePanels.inventory.test.tsx` "equips one dagger from a stack of five"
- [x] Give lists only entities at the player's location; Drop puts the Item Copy at the location: "gives only to the entities at the location", "drops a single Item Copy at the location at once"
- [x] A Bound Item Copy shows Drop and Give as unavailable; the module still lets a `pass` or `script` source move it: "shows Drop and Give as unavailable on a Bound Item Copy", "refuses a panel drop or give of a Bound copy, and lets the pass and scripts move it"
- [x] One invalid operation in a list is skipped with a diagnostic and the rest apply: "skips an invalid operation with a diagnostic and applies the rest"
- [x] The panel tab has a dev-route entry: `#dev?view=gameViewer&fixture=items&tab=inventory`; `devRouter.test.ts` ledger check
- [x] Frames: `.scratch/frames/inventory-panel-light.png`, `.scratch/frames/inventory-panel-dark.png` at 1280 wide, and `.scratch/frames/inventory-panel-mobile.png` at 390 wide: Playwright on the `items` fixture
- [x] The player guide page describes the panel; changelog fragment written: How-to-Play "How to Use Your Inventory"; `docs-internal/changelog.d/inventory-03.md`

For you: play a turn with items and check the panel feels responsive.

## Landed

**Not verified**

- None.

**For you**

- Play a turn with items and check the panel feels responsive. Use `#dev?view=gameViewer&fixture=items&tab=inventory`, or any world with placements.
- Side panel tabs now drop to icons whenever a label would not fit. This applies to both panels, not only the right one. At 1280 wide and on a phone they show icons; at 1600 the left panel keeps its labels. Check it reads well on your screens.
- Frames: `.scratch/inventory-03/frames/inventory-panel-light.png`, `.scratch/inventory-03/frames/inventory-panel-dark.png`, `.scratch/inventory-03/frames/inventory-panel-mobile.png`, `.scratch/inventory-03/frames/inventory-tab-reference.png`.

## Blocked by

- 02
