# 03: Inventory Panel And Core Operations

Status: ready-for-agent
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

- [ ] The user approved the panel layout before it was built
- [ ] Equip, Unequip, Drop and Give change the inventory at once and are off while a turn runs
- [ ] Equipping into a full slot unequips the item equipped there longest; a size-2 item takes two capacity
- [ ] Equipping from a stack of five leaves four in the stack
- [ ] Give lists only entities at the player's location; Drop puts the Item Copy at the location
- [ ] A Bound Item Copy shows Drop and Give as unavailable; the module still lets a `pass` or `script` source move it
- [ ] One invalid operation in a list is skipped with a diagnostic and the rest apply
- [ ] The panel tab has a dev-route entry
- [ ] Frames: `.scratch/frames/inventory-panel-light.png`, `.scratch/frames/inventory-panel-dark.png` at 1280 wide, and `.scratch/frames/inventory-panel-mobile.png` at 390 wide
- [ ] The player guide page describes the panel; changelog fragment written

For you: play a turn with items and check the panel feels responsive.

## Blocked by

- 02
