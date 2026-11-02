# 02: Slot Rule in the Inventory Pass

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Prompt wording is behavior, and it needs probe runs and a reading of the results.

## What to build

The AI sees each item's allowed slots and can name one when it equips (Q41).

The item line reads `Dagger (Main Hand or Off Hand)` and `Greatsword (Main Hand + Off Hand)`. The equip operation's schema gains the optional slot, and the validator skips a bad name as it skips other bad operations. The equip clause changes to match. The Bodies Q55 can't-fit mark follows the validator: Either of fits when any slot exists, and All of fits only when all exist (Q45).

Read `docs-internal/notes/prompt-writing-guide/notes.md` first. Use the `probe` skill and extend the inventory slots probe. Run on the cloud endpoint, with an in-batch control and 5–12 runs per arm. Do not start a local run.

Fold the amends into the closed spec (bodies Q53, Q55).

## Acceptance criteria

- [x] The item line shows both modes in all three context formats. (`inventoryContext.slots.test.ts`: "writes both modes in %s")
- [x] A one-slot item's line reads as it does today. (same file: "names an equippable item's Slot Rule on every face")
- [ ] The can't-fit mark appears per owner, by the rule in Q45.
- [x] A named slot from the pass lands in that slot, and a name the item doesn't allow is skipped with a diagnostic. (`pass.test.ts`: "the pass's named slot"; `either-named` 12/12 below)
- [x] Probe numbers for the new wording against a control are in the Landed section. (below)

For you: Play Emberwatch for a few turns and pick up a dagger and a greatsword. Does the AI equip them sensibly?

## Landed

**Shipped wording.** The item line shows the Slot Rule. The equip clause keeps its wording. The operation gains an optional `slot`. A rule-explaining clause (`one of the slots joined by "or", every slot joined by "+"`) was dropped: it moved no guard and cost `unequip` in the pass probe.

**Probe report.** [inventory-slots-probe.cli.ts](../../../../testing/baseline/harness/inventory-slots-probe.cli.ts), cases in [inventory-slots-cases.json](../../../../testing/baseline/inventory-slots-cases.json). Cloud default, schema request, 12 paired runs per arm per case. Log and dump: `.scratch/shipped.log` and `.scratch/shipped.json`, not kept after the landing. Right-answer rate:

| Case | Want | control (no slots) | first (first slot only) | rule (shipped) |
|---|---|---|---|---|
| slotless-held | no equip | 0/12 | 3/12 | 12/12 |
| slotless-given | no equip | 0/12 | 12/12 | 12/12 |
| normal | equip lands | 12/12 | 12/12 | 12/12 |
| transformed | no equip | 0/12 | 0/12 | 0/12 |
| transformed-odette | no equip | 0/12 | 0/12 | 0/12 |
| either-named | lands in the named slot | 0/12 | 0/12 | 12/12 |
| either-plain | equip lands | 12/12 | 12/12 | 9/12 |
| all-fits | equip lands | 12/12 | 12/12 | 12/12 |
| all-named | equip lands | 12/12 | 10/12 | 12/12 |
| all-lacks | no equip | 0/12 | 0/12 | 0/12 |
| either-partial | equip lands | 12/12 | 12/12 | 12/12 |

- `slotless-given` swings between batches on this endpoint: `rule` scored 12/12 here and 9/12 in an earlier batch of the same wording family. The validator skips those equips.
- `either-plain` lost 3/12 in this batch, the first misses in five batches.
- Why Q65 widened: before the parser change, `all-fits` proposed the equip 12/12 but wrote `Main Hand or Off Hand`, so it landed 0/12 and 1/12.

**Adjacent check.** [inventory-pass-probe.cli.ts](../../../../testing/baseline/harness/inventory-pass-probe.cli.ts), three alternating batches of 8 runs, new prompt against the prompt without the slot field:

| Metric | new prompt | without the field |
|---|---|---|
| schema changes | 134/168 | 129/168 |
| schema no-change guard | 48/48 | 39/48 |
| text changes | 118/168 | 97/168 |
| text no-change guard | 48/48 | 48/48 |

Its `equip` case scores 0 in both arms because that probe's world has no Bodies, so the validator refuses every equip. Ticket 01 left that fixture as it is.

**The can't-fit mark (Q64): not shipped.** Inline `Iron Helm (Head, cannot equip)`, against the same request with no mark, in one paired batch of 12:

| Case | no mark | mark |
|---|---|---|
| transformed | 0/12 | 2/12 |
| transformed-odette | 0/12 | 0/12 |
| all-lacks | 0/12 | 0/12 |
| slotless-held | 12/12 | 0/12 |
| normal | 12/12 | 12/12 |

Other batches of the inline mark gave transformed 10/12 and 2/6, and slotless-held 0/12 and 4/6. A "stays carried" sentence and a separate `carried, cannot equip` field each left transformed at 0/8 and dropped slotless-held to 0/8. Slotless-held fails the gate in every shape. All these batches ran with the dropped rule-explaining clause. No batch ran the mark on the shipped clause; Bodies ticket 07 ran `carry only` on that clause, with the same result.

**Known gap.** An owner whose Body has slots but can't hold the item still gets an equip from the model, 0/12 on transformed, transformed-odette and all-lacks. The validator skips those equips (Bodies Q8, Q39), so the item stays carried.

**Not verified**
- The can't-fit mark: removed under Q64, numbers above.

**For you**
- Play Emberwatch for a few turns and pick up a dagger and a greatsword. Does the AI equip them sensibly?
- A Body that lacks the item's slot: the story may say the item goes on while the Inventory tab keeps it carried. See whether that reads as a bug in play.
