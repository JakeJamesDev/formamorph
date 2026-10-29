# 15: Stat Line Scope And Nested Unequip Depth

Status: ready-for-human
Blocked by: 09, 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Gap found by the spec close review.

## What to build

Two small corrections.

- The stat-pass item line (Q141) names hidden copies too. It should name only visible copies held by you or a present entity, or lying here, of items with stat effect rows (Q149).
- Automatic unequips after nested item-script writes fire one level below the first write, not at their true depth (Q66). They should fire at the depth of the write that caused them.

Spec: Q66, Q141, Q149.

## Acceptance criteria

- [x] The stat line leaves out hidden copies and copies at other places; a test covers it. `statEffectItems` tests in `src/lib/inventory/inventory.test.ts`; red with the visibility filter removed.
- [x] An automatic unequip caused by a depth-2 write fires its timing at depth 3; a test covers it, and the depth cap still holds. `runItemScripts > automatic unequips` in `src/lib/statCodeTurn.itemScripts.test.ts`; red with the unequips sent one level deeper.

## Blocked by

- 09
- 11

## Landed

**Not verified**

- No cloud probe. The line's wording is unchanged; it drops only hidden copies, which the narration never names, so no case can show a difference. Scenes without hidden stat-effect copies send the same request as before.
- The `runItemEvents` wiring in `GameViewer.tsx` has no test of its own: the real `settleInventory` closure, and the replay of settled unequips when Item Copies moved during the runs. `runItemScripts` tests cover the depth contract with a stub settle.

**For you**

- Nothing to judge in play.
