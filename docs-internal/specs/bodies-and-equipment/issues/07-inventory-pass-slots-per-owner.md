# 07: Inventory Pass Slots per Owner

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

This ticket changes a prompt. Read the prompt-writing guide first, and ship it with probe numbers (`probe` skill).

## What to build

The Inventory pass and the narration context list each present owner's slots from the Body in force, with their capacity. They never show the Body's name (Q21). An owner with no Body lists no slots. The validator from 01 already skips an equip into a missing slot. This ticket makes the model stop proposing one.

Spec: Implementation Decisions under AI; Q8, Q21.

## Acceptance criteria

- [ ] The pass request lists each present owner's own slots, and no Body name appears in any prompt
- [ ] An owner with None or no Body lists no slots
- [ ] The probe runs on the cloud default with in-batch controls. Its cases are a slotless owner offered a helmet, a normal equip and a transformed owner. It reports rates per case with the control arm
- [ ] The probe report is linked in the ticket's Landed section

For you: whether equips in play read right for a companion with a different Body.
