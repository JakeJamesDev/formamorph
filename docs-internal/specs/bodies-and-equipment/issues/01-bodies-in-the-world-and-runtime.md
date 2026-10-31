# 01: Bodies in the World and the Runtime

Status: done
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

- [x] Slot has no capacity. The world has an ordered Body list, and an entity has a Default, None or Body pick: `src/types/world.ts`, round-trip in `WorldEditor.itemsListEditor.test.tsx`
- [x] The resolver returns the entity's picked Body, the Default when there is no pick, and no Body for None or for a world with no Bodies: `bodies.test.ts` › bodyInForce (dangling pick → Default, Q33)
- [x] The played Persona resolves through the Custom Persona entity's pick, and a library persona and a library character resolve to the Default: per Q31 a library persona reads the Custom Persona pick and a world persona its own; `bodies.test.ts` › the played Persona
- [x] The validator refuses an equip into a slot the owner's Body lacks, as a skipped operation: `inventory.test.ts` › the owner's Body in force
- [x] Capacity, swap-out and Slot Size checks use the Body entry's capacity: `inventory.test.ts` (one Hand swaps out, size 2 refused); Slot Size max tests in `WorldEditor.itemsListEditor.test.tsx`. The settle unequip is 05's (Q32)
- [x] The Inventory panel shows the owner's Body slots in entry order, and shows none for None: `GamePanels.inventory.test.tsx` › the played Persona's Body in force (stale equip under Carried, Q35)
- [x] CONTEXT.md gains Body, Default Body and Body in force, and Slot is rewritten. `docs/WorldFormat.md` describes the new shape: new Slots and Bodies section, `slots`/`bodies` file rows, entity `body` row

## Landed

**Not verified**
- None. Every box above is ticked by a test.

**For you**
- Emberwatch plays as before: one Humanoid Body holds its four slots, Hands ×2 (Q34). Equip the Spiral-Cut Staff in a new game.
- Overview's Slots section has no Capacity field until 03 brings the Equipment editor. Bodies are file-only until then.
- Deleting a slot also strips it from every Body; 03 adds the count to the confirm.
