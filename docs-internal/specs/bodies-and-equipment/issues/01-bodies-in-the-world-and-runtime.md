# 01: Bodies in the World and the Runtime

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

This ticket changes the shape of a type shared by every slot reader. Inventory is unreleased, so the change happens in place, with no migration (Q10).

## What to build

A world can define Bodies, and each owner equips into its own Body's slots. A Slot is a name only. A Body is a name and an ordered list of entries. Each entry is an object with a slot reference and a capacity, where absent means 1, so that a later paperdoll can add a position to it. An entity has a Body pick: Default (absent), None, or a Body id. The first Body in the world's list is the Default.

This ticket owns the one **Body in force** resolver. In this ticket it reads only the authored pick, the Default and None. Ticket 05 adds trait overrides, and 06 adds the saved base Body. For the played Persona, the pick comes from the Custom Persona entity. Library personas, library characters and AI-introduced characters use the Default. The validator refuses an equip into a slot the owner's Body lacks, and both the validator and `settleInventory` read capacity from the Body in force. The Inventory panel lists the Body's slots in entry order.

The editor UI comes in 03. In the Overview Slots section, this ticket only removes the capacity field, so the editor still builds. It also updates any Slot Size bound that read slot capacity.

Spec: Solution; Implementation Decisions under Data and Body in force; Q3, Q8 (validator half), Q9, Q22, Q26, Q27, Q28.

## Acceptance criteria

- [ ] Slot has no capacity. The world has an ordered Body list, and an entity has a Default, None or Body pick
- [ ] The resolver returns the entity's picked Body, the Default when there is no pick, and no Body for None or for a world with no Bodies
- [ ] The played Persona resolves through the Custom Persona entity's pick, and a library persona and a library character resolve to the Default
- [ ] The validator refuses an equip into a slot the owner's Body lacks, as a skipped operation
- [ ] Capacity, swap-out and Slot Size checks use the Body entry's capacity
- [ ] The Inventory panel shows the owner's Body slots in entry order, and shows none for None
- [ ] CONTEXT.md gains Body, Default Body and Body in force, and Slot is rewritten. `docs/WorldFormat.md` describes the new shape
