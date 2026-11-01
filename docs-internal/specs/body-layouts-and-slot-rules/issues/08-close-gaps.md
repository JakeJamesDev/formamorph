# 08: Close Gaps

Status: ready-for-human
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

- [x] A placement naming a slot its owner's Body lacks shows the warning, and each test fails with the old code. (`warns on a named slot the Body lacks`; red with the check disabled)
- [x] The slot select lists only allowed slots the owner's Body holds. (`lists only the rule's slots the owner's Body holds`)
- [x] Custom Image then the same outline leaves the aspect and boxes unchanged. (`keeps the aspect and boxes when the current outline is picked again`)
- [x] Quantity 2 with a named slot on two capacity 1 slots ends with both equipped, the first in the named slot. (`sends the first unit of a quantity-2 placement to the named slot`)
- [x] "both Main Hand and Off Hand" and "Main Hand with Off Hand" land the equip by Q37 and Q38. (`reads %s as no name`, Either of and All of)
- [x] A single disallowed name and an unknown name are still skipped with a diagnostic. (`skips Main Hand or Left Paw`, `Left Paw`)
- [x] Typing 12 over 2 in Capacity, through "1", keeps the placed boxes, and blur applies the final value. (`applies a typed capacity when the edit ends`; Enter applies it too)

## Landed

**Not verified**
- A live look at the Capacity field and the Slot select: only jsdom tests ran.

**For you**
- Slot select on a Placement whose named slot the Body lacks: the trigger shows the slot's name, the list omits it, and the warning reads "<Body> has no <Slot> slot. <Item> starts carried." Check it reads right in Items.
- Q65 now counts any value holding two of the item's own names as no name. The old skip case `Main Hand or Off Handle` holds two names by substring, so it no longer skips. I dropped it from the skip list.
- No changelog fragment: all five fixes touch unreleased Body Layouts and Slot Rules work.
