# 08: Close Gaps

Status: ready-for-agent
Blocked by: 01, 02, 03, 04, 05, 06, 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Five small fixes in known places, found by the close review of this effort.

## What to build

**Placement warning (Q76).** The warning reads the placement's named slot: it warns when the owner's Body lacks that slot. The slot select lists only allowed slots the owner's Body holds, and a named slot the Body lacks reads as a warning, not silently as a slot.

**Re-picking an outline (Q77).** Picking the Backdrop the Body already has changes nothing. Picking Custom Image, then the current outline again, keeps a dragged aspect and the boxes.

**Quantity and a named slot (Q78).** A placement with quantity 2+ and a named slot sends the first unit to that slot. The other units take the first free slot, as the Inventory pass does.

**Slot value joins (Q65).** A `slot` value that holds two or more of the item's own slot names counts as no name, whatever else joins them. "both Main Hand and Off Hand" and "Main Hand with Off Hand" both count. A value with one name stays as Q65 says.

**Capacity field (Q79).** Typing in a Body entry's Capacity field changes the boxes only when the edit ends, on blur or Enter. Backspacing through a value drops no boxes.

## Acceptance criteria

- [ ] A placement naming a slot its owner's Body lacks shows the warning, and each test fails with the old code.
- [ ] The slot select lists only allowed slots the owner's Body holds.
- [ ] Custom Image then the same outline leaves the aspect and boxes unchanged.
- [ ] Quantity 2 with a named slot on two capacity 1 slots ends with both equipped, the first in the named slot.
- [ ] "both Main Hand and Off Hand" and "Main Hand with Off Hand" land the equip by Q37 and Q38.
- [ ] A single disallowed name and an unknown name are still skipped with a diagnostic.
- [ ] Typing 12 over 2 in Capacity, through "1", keeps the placed boxes, and blur applies the final value.
