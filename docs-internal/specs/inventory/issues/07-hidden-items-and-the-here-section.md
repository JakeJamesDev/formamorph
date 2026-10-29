# 07: Hidden Items And The Here Section

Status: ready-for-human
Blocked by: 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: UI and one new operation on an existing validator, with the shapes already in place.

## What to build

The panel gets a **Here** section listing the visible Item Copies lying at the player's location. Hidden Item Copies never show for the player, whether they lie at a location or an owner has them (Q26, Q30). A **reveal** operation in the Inventory module makes a hidden Item Copy visible (Q28); hidden and visible Item Copies of one item stay separate rows until the reveal, then merge (Q65). Hidden owned Item Copies still apply their effects, and the turn log shows the change as "An item" (Q63, Q106).

The entity panel shows that entity's visible equipped items only (Q31).

Spec: Q26, Q28, Q30, Q31, Q63, Q65; stories 78–82.

## Acceptance criteria

- [x] The Here section lists visible location Item Copies and omits hidden ones (`GamePanels.inventoryHere.test.tsx`: lists visible, omits hidden and other places)
- [x] A hidden owned Item Copy never shows in any panel, and its stat change logs as "An item" (Q106) (panel test `never shows a hidden owned Item Copy`; the log line is `effects.test.ts` "An item: Luck +1", from 04)
- [x] Reveal makes a hidden Item Copy visible and merges it into a visible stack of the same item (`reveal.test.ts`; mutation: replacing the merge with an in-place flip failed it)
- [x] The entity panel shows an entity's equipped items and none of its carried items (`EntityEquipped` tests)
- [ ] Frames: `.scratch/frames/inventory-here-light.png` and `-dark.png` at 1280 wide (stored from a 1280 viewport, but the pane's screenshots are 800 px wide; the light frame shows icon glyphs not yet loaded)
- [x] The player guide describes the Here section; changelog fragment written (`docs/How-to-Play.md`, `docs-internal/changelog.d/inventory-07.md`)
- [x] Item images shown in play resolve their rules through `itemRuleStates` with the Item Copy (from ticket 10's landing: it has no play-time caller yet) (`visibleItemImage` in the panel; test swaps the shown image with a Condition)
- [x] A locked trait's gate line never names a hidden Item Copy's item to the player (Q63; from ticket 10's landing) (`traitGates.item.test.ts`; Q115)
- [x] A hidden equipped Item Copy has a defined slot display and swap-out rule: today it fills its slot's "n of m" count unseen, and the next equip can swap it out (from ticket 03; only 09 and 11 can create one). Ask the spec session for the rule before building (Q112: panel and count show visible only; swap-out test in `reveal.test.ts`, panel test in `GamePanels.inventory.test.tsx`)

## Blocked by

- 03
- 04 (owns the stat panel's source naming that Q63 hides)

## Landed

**Not verified**

- Frames at 1280 wide: the browser pane screenshots at 800 px, so the stored frames are scaled. The light frame shows icon glyphs not yet loaded.
- Entity dialog Equipped list in a browser: covered by a jsdom test only.
- A `Not` item Condition matched by a hidden copy still reads "Requires not owning X", the authored text. I left it as is.

**For you**

- Look at the Inventory tab Here section in light and dark: `.scratch/inventory-07/frames/inventory-here-light.png` and `.scratch/inventory-07/frames/inventory-here-dark.png`.
- Entity dialog of a world entity with a worn item: check the Equipped list sits well under the description.
- Entity dialog Equipped rows have no thumbnails (Q113 covers the Inventory tab rows); say if you want them there.
