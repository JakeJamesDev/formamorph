# 04: Stat Effects

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: xhigh

Opus at xhigh: exact reversal after clamping and the derived-bounds path are easy to get subtly wrong, and every later effect builds on this.

## What to build

Items change their owner's stats. The item editor gets stat effect rows: a stat the owner has (Q50), a facet (value, min, max, regen; Q51), a timing (While Equipped, While Owned, On First Obtain), an amount and an `add` op (Q45 hook 5). After Consumed rows come in 06.

While Equipped and While Owned value changes record what they actually moved on the applied-effect ledger and reverse exactly that when they end (Q6). Min, max and regen effects join the derived bounds as trait contributions do, so they need no ledger. A While Owned effect applies once per owner, however many Item Copies (Q11). On First Obtain applies once per owner and is recorded. Seeded Item Copies apply their effects (Q59). An owner without the named stat skips the row with a diagnostic. Orphan cleanup on load (02) now reverses the dropped Item Copy's effects. The stat panel names the item as a change's source.

Spec: Q4, Q5, Q6, Q11, Q39, Q50, Q51, Q59, Q60; stories 11–15, 19, 21, 24, 51, 53.

## Acceptance criteria

- [x] Stat effect rows edit in the item editor with facet, timing and amount — Effects tab in the preview (`fixture=entityStats`): row added, picker lists owners' stats under headings, Nerve picked; frame `.scratch/inventory-04/frames/effects-stat-picker-dark-800.png`
- [x] Equipping a +2 Strength sword raises Strength by 2; unequipping returns exactly what it moved, including when the gain was clamped — `effects.test.ts` "raises Strength by 2…", "returns exactly what a clamped gain moved"
- [x] A +5 Max Health While Owned effect raises the derived maximum and leaves no ledger entry — "raises the derived maximum…records no value movement"; a cap carry is recorded per Q110 ("carries a value resting at its cap…")
- [x] Three Item Copies of a While Owned item apply the effect once — "applies a While Owned effect once…"
- [x] On First Obtain applies once per owner, and not again after the item is lost and regained — "applies On First Obtain once per owner…"
- [x] An owner without the stat gets a diagnostic and no change — "skips a row whose stat the owner lacks…"
- [x] A seeded Item Copy's effects are in place on the first turn — `openingState.test.ts` "puts the seeded Item Copies' effects in place…"
- [x] Dropping an orphaned Item Copy on load reverses its effects — `GameplayContext.itemCopies.test.tsx` "reverse a dropped Item Copy's effects, in the state and its history"
- [x] The stat panel names the item as the source of its changes — replaced by Q106's log line; "raises Strength by 2…" reads "Iron Sword: Strength +2", "names no item for a hidden Item Copy" reads "An item: Luck +1"
- [x] Guard tests fail when the reversal ignores clamping and when While Owned counts per copy — mutation-tested: authored-amount reversal fails the clamp test; a per-copy key fails the once-per-owner test
- [x] The item docs page describes stat effect rows; changelog fragment written — `docs/World-Editor-Items.md` Effects section; `docs-internal/changelog.d/inventory-04.md`

## Blocked by

- 03

## Landed

**Not verified**

- None of the criteria. Two paths have no test of their own: the panel's settle in `useInventoryPanel.ts` and the persona-switch settle in `GameViewer.tsx` call the tested `settleItemEffects`, but no test drives either hook.

**For you**

- Equip a stat item from the Inventory tab in a world whose Persona has its own stats: the stat moves, and the log reads "Item: Stat +N". Unequip and check it returns.
- A player modeled only with Global Stats gets no item effects (Q107); the log names each skipped row. Check this reads right in a real world.
- Loading a save from another world drops an orphaned Item Copy but reverses its effects only at the next inventory change.
