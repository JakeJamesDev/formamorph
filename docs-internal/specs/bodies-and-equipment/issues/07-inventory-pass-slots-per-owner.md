# 07: Inventory Pass Slots per Owner

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

This ticket changes a prompt. Read the prompt-writing guide first, and ship it with probe numbers (`probe` skill).

## What to build

The Inventory pass and the narration context list each present owner's slots from the Body in force, with their capacity. They never show the Body's name (Q21). An owner with no Body lists no slots. The validator from 01 already skips an equip into a missing slot. This ticket makes the model stop proposing one.

Spec: Implementation Decisions under AI; Q8, Q21.

## Acceptance criteria

- [x] The pass request lists each present owner's own slots, and no Body name appears in any prompt (`inventoryContext.slots.test.ts`: "the Inventory pass request" and "the narration prompt", both with a `Humanoid|Beast` absence check)
- [x] An owner with None or no Body lists no slots (it reads `slots: none` per Q52; a world with no Bodies omits the line; tests "writes none for an owner under None", "names no slot in a world with no Bodies")
- [x] The probe runs on the cloud default with in-batch controls. Its cases are a slotless owner offered a helmet, a normal equip and a transformed owner. It reports rates per case with the control arm (`inventory-slots-probe.cli.ts`, report below)
- [x] The probe report is linked in the ticket's Landed section

For you: whether equips in play read right for a companion with a different Body.

## Landed

**Probe report.** [inventory-slots-probe.cli.ts](../../../../testing/baseline/harness/inventory-slots-probe.cli.ts), cases in [inventory-slots-cases.json](../../../../testing/baseline/inventory-slots-cases.json). Cloud default, schema request, 8 paired runs per arm per case. Log and dump: `.scratch/bodies-and-equipment-07/frames/slots-probe.log` and `slots-probe.json`. The final batch (the shipped build) gives the right-answer rate:

| Case | Want | control (no slots) | slots | clause (shipped) |
|---|---|---|---|---|
| slotless-held (None, carries the helm) | no equip | 0/8 | 8/8 | 8/8 |
| slotless-given (None, handed the helm: the Q52 edge) | no equip | 0/8 | 7/8 | 8/8 |
| normal (Default) | equip lands | 8/8 | 8/8 | 8/8 |
| transformed (player on the Wolf) | no equip | 0/8 | 0/8 | 0/8 |
| transformed-odette (entity on the Wolf) | no equip | 0/8 | 0/8 | 0/8 |

- The clause earns its place on the Q52 edge: across three batches, slots-only scored 20/24 and clause 24/24. Its wording is "when that owner's slots include the slot shown after the item's name". The first wording, "in a slot Items Here lists for that owner", tied slots-only at 8/8.
- **Known gap (Q55).** A Body that has slots but lacks the item's slot is still equipped, 0/8 in every arm. Per-owner `carry only` marks did not move it (0/8 on both transformed cases), and they dropped slotless-held to 1/8. The marks were removed. The validator skips these equips (Q8), so play is unharmed.

**Not verified**
- None. Every box above is ticked by a test or the probe.

**For you**
- Whether equips in play read right for a companion with a different Body.
- A transformed owner whose Body lacks a slot: the story may still say a helm goes on, and the Inventory tab keeps it carried. See whether that reads as a bug in play.
- Ticket 05 wires `traitPicks` into `inventoryWorld` in `GameViewer.tsx`; the prompt reads that same object (Q54).
