# 14: Runtime Item Description

Status: done
Blocked by: 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Gap found by the spec close review.

## What to build

The spec defines a runtime item as a name and a short description, created by the pass. `RuntimeItem.description` exists, but the pass never fills it. The pass schema and text format gain an optional short description on a gain that creates a runtime item; the panel and the narration chip show it.

Spec: the Runtime item definition; Q24, Q36, Q56. A prompt change: ships with probe numbers.

## Acceptance criteria

- [x] The pass fills the description when it creates a runtime item; an existing runtime item keeps its first description — per Q148 a `describeItem` Background Pass Queue kind fills it, not the pass; `describe.test.ts` (`withItemDescription` first-wins, mutation-checked; due selection; cleaner) and `backgroundPassQueue.test.ts` "describe item (Q148)"
- [x] The panel and the inventory chip show it — `GamePanels.inventory.test.tsx` "shows a runtime item’s description under its name (Q146)"; `inventoryContext.test.ts` "gives a described runtime item a line of its own" (Q145)
- [ ] Probe numbers on cloud and Cydonia with in-batch controls: operation accuracy does not drop — cloud only; see Landed

## Blocked by

- 09

## Landed

Probe record (cloud default, all 2026-10-29):

| What | Result |
|---|---|
| Description field in the pass schema, after `item` (Q143, dropped) | hidden `search` reveal 2/8, 3/8, 7/8, 7/12 vs base 28/28 in-batch; led to Q148 |
| Field after `to` | schema changes 26/56: the grammar forbids closing the object, the model loops on whitespace |
| Inline `Name: sentence` in `item` | accuracy held (81/84 vs 80/84) but 0/24 descriptions |
| `describeItem` request (shipped) | 30/30 filled, 5 items × 6 runs |
| Pass probe, request byte-identical to base | text 56/56, schema 49/56 (`unequip` 1/8, the case that drifts 4/8–12/12 in base arms), guards 16/16 |
| 08 chip probe | names-own 4/8, hidden-leak 0/40, summary 7/8; 08 recorded 5–6/12, 0/60, 6/12 |

**Not verified**
- Cydonia probes: the pass request is byte-identical to base under Q148, so op accuracy cannot move; the `describeItem` fill rate was asked on cloud only.
- The panel line in a live game: covered by the jsdom test, not a preview frame.

**For you**
- Play a turn that finds an item the world lacks, then open the Inventory tab: the item shows a one-sentence description under its name once the model is idle.
- Re-rolling a later turn keeps the first description (Q144), even when the new narration describes the item differently.
