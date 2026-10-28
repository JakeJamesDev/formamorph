# 04: Stat Effects

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: xhigh

Opus at xhigh: exact reversal after clamping and the derived-bounds path are easy to get subtly wrong, and every later effect builds on this.

## What to build

Items change their owner's stats. The item editor gets stat effect rows: a stat the owner has (Q50), a facet (value, min, max, regen; Q51), a timing (While Equipped, While Owned, On First Obtain), an amount and an `add` op (Q45 hook 5). After Consumed rows come in 06.

While Equipped and While Owned value changes record what they actually moved on the applied-effect ledger and reverse exactly that when they end (Q6). Min, max and regen effects join the derived bounds as trait contributions do, so they need no ledger. A While Owned effect applies once per owner, however many Item Copies (Q11). On First Obtain applies once per owner and is recorded. Seeded Item Copies apply their effects (Q59). An owner without the named stat skips the row with a diagnostic. Orphan cleanup on load (02) now reverses the dropped Item Copy's effects. The stat panel names the item as a change's source.

Spec: Q4, Q5, Q6, Q11, Q39, Q50, Q51, Q59, Q60; stories 11–15, 19, 21, 24, 51, 53.

## Acceptance criteria

- [ ] Stat effect rows edit in the item editor with facet, timing and amount
- [ ] Equipping a +2 Strength sword raises Strength by 2; unequipping returns exactly what it moved, including when the gain was clamped
- [ ] A +5 Max Health While Owned effect raises the derived maximum and leaves no ledger entry
- [ ] Three Item Copies of a While Owned item apply the effect once
- [ ] On First Obtain applies once per owner, and not again after the item is lost and regained
- [ ] An owner without the stat gets a diagnostic and no change
- [ ] A seeded Item Copy's effects are in place on the first turn
- [ ] Dropping an orphaned Item Copy on load reverses its effects
- [ ] The stat panel names the item as the source of its changes
- [ ] Guard tests fail when the reversal ignores clamping and when While Owned counts per copy
- [ ] The item docs page describes stat effect rows; changelog fragment written

## Blocked by

- 03
