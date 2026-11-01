# 01: Slot Rule

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rule logic crosses the validator, the settle and every occupancy reader, so this needs judgment.

## What to build

An item names its slots and a mode: **Either of** takes one, **All of** takes every one (Q35–Q40). A player can hold a dagger in either hand, and a greatsword takes both.

Replace `Item.slotId` and `Item.slotSize` with the spec's `SlotRule`. This ticket owns the helper that answers which slots a copy occupies. Every occupancy reader moves onto it: the validator, the Body settle, the panel, the prompt context, the sandbox read, the Player View and trait gates. The prompt line keeps its current form for now, with the first slot named; ticket 02 owns its wording.

This ticket owns the optional slot on the equip operation (Q37). The item editor gets the mode select and slot multi-select (Q36). The Inventory tab's list view offers one Equip choice per allowed slot.

Emberwatch moves to Main Hand + Off Hand, and its Slot Size 2 item becomes All of (Q44). Follow the bundled-worlds skill.

The save does not change: `equipped.slotId` is the chosen slot for Either of and the first listed slot for All of.

Fold the amends into the closed specs (inventory Q77; bodies Q8) and update CONTEXT.md's Slot entry. Update the wiki and help pages that describe Slot Size.

## Acceptance criteria

- [ ] An Either of equip takes the first free allowed slot in the item's order, or the named slot.
- [ ] With every allowed slot full, it swaps out in the named slot, or in the first listed slot if none is named (Q38).
- [ ] An All of equip is refused when the owner's Body lacks any of its slots (Q39).
- [ ] An All of equip takes one unit in each slot and swaps out only what it needs, longest equipped first.
- [ ] A Body change that removes any slot of an All of item takes the whole item off, and When Unequipped fires (Q40).
- [ ] Capacity shrink still takes off the most recently equipped item (Bodies Q12).
- [ ] An Either of copy keeps its slot across save and load.
- [ ] The item editor's control writes the rule, and one slot reads the same in both modes.
- [ ] The panel shows one Equip choice per allowed slot for an item with a choice, and one Equip button otherwise.
- [ ] No reader of `slotSize` or `Item.slotId` remains.
- [ ] Emberwatch loads with the new slots, and its two-handed item takes both hands.

For you: Emberwatch, Items list: does the Either of / All of control read clearly when you set a dagger and a greatsword?
