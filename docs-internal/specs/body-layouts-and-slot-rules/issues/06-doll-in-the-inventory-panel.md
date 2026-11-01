# 06: Doll in the Inventory Panel

Status: ready-for-human
Blocked by: 01, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

A display component on settled rulings, with layout and hit-test details to get right.

## What to build

In the in-game Inventory tab, the figure replaces the Equipped slot list for the player. Carried sits below it (Q3, Q11). Entity cards keep their list.

Copies fill a capacity slot's boxes by equip order and reflow after an unequip (Q20, Q21). An All of item shows its image in each box it fills (Q8). An image fits inside its box at its own aspect, and the frame hugs it (Q7). An item with no image shows its name (Q10). An empty box is a blank outline, with the slot name on hover or tap (Q9, Q22). Tapping a filled box offers Use and Unequip (Q12). A tap on a filled box's margin falls through (Q48). Stacking comes from ticket 04's module (Q47). The doll caps its height, about 320 px for a Humanoid, and its width follows the aspect (Q49).

Update the Design System's Inventory Tab reference with an All of example, and the wiki's Inventory page.

## Acceptance criteria

- [x] The doll shows the Body in force, and a Body change swaps the figure. Test "swaps with the Body in force", through two picks on a fresh mount; `bodyInForce` feeds the panel's `body`.
- [x] Copies fill boxes in equip order and reflow after an unequip. Test "fills a slot by equip order"; a mutation dropping the key failed it.
- [x] An All of item draws in each box it fills. Test "draws an All of image in each box", and the frames.
- [x] A 240×720 image in a wider box draws at its own aspect, with the frame hugging it. Playwright margin test measures the Silver Ring frame at 1:3.
- [x] An imageless item shows its name, cut short when it doesn't fit. A long name in a live box read 2 clamped lines inside the frame, and the failed-image test.
- [x] An empty box shows no text until hover or tap. Tests "shows the slot name on a tap" and Playwright "hover names".
- [x] A tap on a filled box offers Use and Unequip, and they work. Tests "spends a use on an equipped wand" and "unequips an item into the carried list".
- [x] A Playwright check proves a tap on a margin reaches the box below. `e2e/inventory-doll.spec.ts`, desktop and mobile; removing `pointer-events-none` failed it.
- [x] A Humanoid doll stays within the height cap and Carried starts below it, at 1440 and 375 wide. `e2e/inventory-doll.spec.ts`, both themes.
- [x] Frames saved as `.scratch/frames/inventory-doll-<theme>-<width>.png` in light and dark, at 1440 and 375 wide. Written by the same spec.

## Landed

**Not verified**

- Nothing left unticked. No test changes a Body while the panel stays mounted; the swap test remounts on the second pick.
- A long name in a box shorter than two lines is clipped by the frame, with no ellipsis.

**For you**

- Play Emberwatch: does the figure read well at panel size, and are small boxes large enough at the height cap?
- Approve the figure in the Inventory tab for the Design System's record. Frames: `.scratch/body-layouts-and-slot-rules-06/frames/inventory-doll-light-1440.png`, `inventory-doll-dark-1440.png`, `inventory-doll-light-375.png`, `inventory-doll-dark-375.png`.
