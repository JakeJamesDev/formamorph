# 01: Uses and When Empty

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A wide rename across every item reader. Inventory is unreleased, so it renames in place with no migration.

## What to build

An author sets how many times an item can be used (**Uses**, blank = unlimited) and what happens when the uses run out (**When Empty**: Stays, Gone, Becomes another authored item). These replace Consumable and Charges everywhere. Any item with Uses, On Use effects or an On Use script can be used from the Inventory tab. Using it fires its effects, counts down its uses, and on the last use runs When Empty on that one copy. A Becomes result is a carried copy of the target for the same owner.

The Changes State outcome lands in 02. The pass still sends `consume` and maps it to Use, so the pass prompt does not change here (04 renames it).

Spec: Solution; Implementation Decisions under The Item and the Item Copy and The operation validator; Q5, Q11, Q12, Q20, Q21.

## Acceptance criteria

- [ ] The Item has Uses and When Empty (Stays, Gone, Becomes) and no Consumable or Charges; each copy counts its own uses
- [ ] Uses 1 stacks; Uses 2 or more does not
- [ ] A use fires On Use effects and the `used` script event, counts down, and is refused at zero uses
- [ ] On the last use: Stays keeps the copy at zero; Gone removes one; Becomes removes one and gives the owner one carried copy of the target
- [ ] A use of an item with no Uses fires its effects and leaves the copy as it was
- [ ] A runtime item's use still removes one, as consume does today
- [ ] The Inventory tab shows Use per Q20, shows uses left, and turns Use off at zero
- [ ] The Items editor has Uses and When Empty, with an item picker for Becomes; the reference check flags a deleted Becomes target; the Effects tab offers After Use rows when the item can be used
- [ ] After Consumed reads After Use, and the script timing `consumed` reads `used`
- [ ] Scripts read `uses` and set it with `setUses`; `use()` follows the validator
- [ ] Formaquestion's player view and world index facts show Uses and When Empty in place of Consumable and Charges
- [ ] Emberwatch's items move to Uses and When Empty, and its world tests pass
- [ ] The glossary, the Items wiki page and the Scripts guide describe Uses, When Empty and Use, and drop Consumable and Charges

## Blocked by

- None (can start immediately)
