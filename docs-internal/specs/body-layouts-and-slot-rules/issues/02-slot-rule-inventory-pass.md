# 02: Slot Rule in the Inventory Pass

Status: ready-for-agent
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

- [ ] The item line shows both modes in all three context formats.
- [ ] A one-slot item's line reads as it does today.
- [ ] The can't-fit mark appears per owner, by the rule in Q45.
- [ ] A named slot from the pass lands in that slot, and a name the item doesn't allow is skipped with a diagnostic.
- [ ] Probe numbers for the new wording against a control are in the Landed section.

For you: Play Emberwatch for a few turns and pick up a dagger and a greatsword. Does the AI equip them sensibly?
