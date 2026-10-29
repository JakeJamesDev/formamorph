# 07: Hidden Items And The Here Section

Status: ready-for-agent
Blocked by: 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: UI and one new operation on an existing validator, with the shapes already in place.

## What to build

The panel gets a **Here** section listing the visible Item Copies lying at the player's location. Hidden Item Copies never show for the player, whether they lie at a location or an owner has them (Q26, Q30). A **reveal** operation in the Inventory module makes a hidden Item Copy visible (Q28); hidden and visible Item Copies of one item stay separate rows until the reveal, then merge (Q65). Hidden owned Item Copies still apply their effects, and the stat panel shows the change without the item's name (Q63).

The entity panel shows that entity's visible equipped items only (Q31).

Spec: Q26, Q28, Q30, Q31, Q63, Q65; stories 78–82.

## Acceptance criteria

- [ ] The Here section lists visible location Item Copies and omits hidden ones
- [ ] A hidden owned Item Copy never shows in any panel, and its stat change shows without the item's name
- [ ] Reveal makes a hidden Item Copy visible and merges it into a visible stack of the same item
- [ ] The entity panel shows an entity's equipped items and none of its carried items
- [ ] Frames: `.scratch/frames/inventory-here-light.png` and `-dark.png` at 1280 wide
- [ ] The player guide describes the Here section; changelog fragment written
- [ ] Item images shown in play resolve their rules through `itemRuleStates` with the Item Copy (from ticket 10's landing: it has no play-time caller yet)
- [ ] A locked trait's gate line never names a hidden Item Copy's item to the player (Q63; from ticket 10's landing)

## Blocked by

- 03
- 04 (owns the stat panel's source naming that Q63 hides)
