# 11: Item Scripts

Status: ready-for-human
Blocked by: 06, 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a new script home and timings, a new world-write kind, and re-entry limits.

## What to build

Items run scripts. Items become a script home with five timings: **When Gained**, **When Lost**, **When Equipped**, **When Unequipped** and **When Consumed** (Q33). They fire from the Inventory module's script events; seeding fires none (Q59). On an item, the script `owner` is the Item Copy's owner, empty while it lies at a location (Q67).

The script surface gains inventory reads (who owns what) and an inventory write kind in `WorldWrites`: gain, lose, transfer, equip, unequip, consume, reveal and set charges (Q41). Script writes go through the Inventory module with the source `script`, so Bound does not block them (Q58). Item script writes fire item timings up to a depth of 3, then stop with a diagnostic (Q66). A panel action between turns runs item scripts against the current committed state.

Spec: Q33, Q41, Q58, Q59, Q66, Q67; stories 6, 43, 45, 89–92.

## Acceptance criteria

- [x] The item editor has a Scripts section with the five timings — Advanced-mode Scripts tab; DOM read of the Timing menu lists the five item timings; frame `.scratch/inventory-11/frames/item-scripts-tab.jpg`
- [ ] Each timing fires once for its event from the panel, the pass and scripts; seeding fires none — module events: `inventory/events.test.ts`; runner: `statCodeTurn.itemScripts.test.ts`; seeding emits no events by construction. Panel and script landings wired in GameViewer, not driven in a test or the live game; the pass is ticket 09's call
- [x] A script can read who owns an item and gain, lose, move, equip, consume, reveal and recharge Item Copies — `statCodeExecutor.items.test.ts` (reads, every verb), `events.test.ts` (setCharges)
- [x] A script removes a Bound Item Copy — `statCodeTurn.itemScripts.test.ts` "removes a Bound Item Copy"; `events.test.ts` Bound by source
- [x] A When Gained script that gives an item chains to depth 3 and then stops with a diagnostic — `statCodeTurn.itemScripts.test.ts`; mutation (cap + 1) turned it red
- [x] An item script's `owner` reads the Item Copy's owner — `statCodeTurn.itemScripts.test.ts` owner case, empty at a location
- [x] CONTEXT.md's Timing and script-home entries list items; the Scripts guide describes the timings and writes; changelog fragment written — Script, Timing, Item timings entries; ScriptsGuide Item Timings, Items, Quick Reference (`statCodeQuickReference.test.ts`); `docs-internal/changelog.d/inventory-11.md`
- [x] The `items` script global reaches item placeholder code paths (`items["Name"].placeholders…`) that ticket 01 already names — `statCodeVariableTree.test.ts` runs every `items["Brass Lamp"].placeholders…` leaf in the sandbox
- [ ] The play-time stat-code sandbox state carries Item Copies, and discarding an unpaired user turn restores Item Copies that before-box scripts wrote (from ticket 02's landing) — state carries `itemCopies`, `items` and `slots` from `prepareStatCode`; the discard restore is wired, not driven in a test

## Blocked by

- 06
- 07

## Landed

**Not verified**

- Each timing fires from the panel, the pass and scripts: the GameViewer landings (`runItemEvents`, `landScriptInventory`, the panel commit) run in no test. The pass call is ticket 09's: `void runItemEvents([...result.events, ...settled.events])` in `landInventoryPass`.
- Discarding an unpaired user turn restores Item Copies a before-box script wrote: wired through `turnStartItemsRef`, and the discard drops item runs that turn started. No test drives it.
- Review notes for later tickets:
  - Two items sharing one code name: an item script on the hidden one reads the blank `items` entry as `self`.
  - An After the AI script's inventory writes land again on a stats re-roll unless the re-roll restores Item Copies first.
  - Auto-unequips after nested item-script writes fire at the next level from the first, an approximation of their true depth.

**For you**

- In Advanced mode, open an item's **Scripts** tab and add a When Gained script, then pick the item up in play and check it runs. (`#dev?modal=worldEditor&tab=items&fixture=items`)
- Frame: `.scratch/inventory-11/frames/item-scripts-tab.jpg`
