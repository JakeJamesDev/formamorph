# 01: Uses and When Empty

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A wide rename across every item reader. Inventory is unreleased, so it renames in place with no migration.

## What to build

An author sets how many times an item can be used (**Uses**, blank = unlimited) and what happens when the uses run out (**When Empty**: Stays, Gone, Becomes another authored item). These replace Consumable and Charges everywhere. Any item with Uses, On Use effects or an On Use script can be used from the Inventory tab. Using it fires its effects, counts down its uses, and on the last use runs When Empty on that one copy. A Becomes result is a carried copy of the target for the same owner.

The Changes State outcome lands in 02. The pass still sends `consume` and maps it to Use, so the pass prompt does not change here (04 renames it).

Spec: Solution; Implementation Decisions under The Item and the Item Copy and The operation validator; Q5, Q11, Q12, Q20, Q21.

## Acceptance criteria

- [x] The Item has Uses and When Empty (Stays, Gone, Becomes) and no Consumable or Charges; each copy counts its own uses (types in `world.ts`/`gameplay.ts`; consume.test `keeps each wand its own count when one is given away`)
- [x] Uses 1 stacks; Uses 2 or more does not (consume.test `stacks an item with Uses 1 and keeps one with Uses 2 apart`; items.test)
- [x] A use fires On Use effects and the `used` script event, counts down, and is refused at zero uses (consume.test `keeps a three-use wand that Stays at zero, and refuses a fourth use`; events.test Q28 case)
- [x] On the last use: Stays keeps the copy at zero; Gone removes one; Becomes removes one and gives the owner one carried copy of the target (consume.test Stays/Gone/Becomes cases, equipped and hidden sources included; Q27 split and Q29 missing target tested)
- [x] A use of an item with no Uses fires its effects and leaves the copy as it was (consume.test `fires the effects of an item with no Uses and leaves the copy as it was`)
- [x] A runtime item's use still removes one, as consume does today (consume.test `removes one of a runtime item on use`; pass.test runtime consume)
- [x] The Inventory tab shows Use per Q20, shows uses left, and turns Use off at zero (GamePanels.inventory.test Q20 and Q30 cases, wand `1 of 3 uses`)
- [x] The Items editor has Uses and When Empty, with an item picker for Becomes; the reference check flags a deleted Becomes target; the Effects tab offers After Use rows when the item can be used (WorldEditor.itemsListEditor.test When Empty and Becomes picker; rules.test `item-becomes-missing-item`; ItemEffectsFields.test Q25; live frame `.scratch/item-use-and-identity-01/frames/item-properties-uses.jpg`)
- [x] After Consumed reads After Use, and the script timing `consumed` reads `used` (scripts.ts labels, ItemEffectsFields timing list; typecheck holds no `consumed` timing)
- [x] Scripts read `uses` and set it with `setUses`; `use()` follows the validator (statCodeExecutor.items.test verb writes and `uses` field; statCodeAnalysis.itemScript.test)
- [x] Formaquestion's player view and world index facts show Uses and When Empty in place of Consumable and Charges (playerViewWorld.test `keeps a met item’s Uses and When Empty`; worldIndex.test facts case)
- [x] Emberwatch's items move to Uses and When Empty, and its world tests pass (Draught and Tea Uses 1 Gone, Lantern Uses 3 Stays; emberwatchWorld tests green)
- [x] The glossary, the Items wiki page and the Scripts guide describe Uses, When Empty and Use, and drop Consumable and Charges (CONTEXT.md Use/Uses/When Empty; World-Editor-Items.md; ScriptsGuide.md; How-to-Play and Design-System too)

## Blocked by

- None (can start immediately)

## Landed

**Not verified**

- None. Every criterion has a test or a frame.

**For you**

- The Items **Properties** tab: Uses, When Empty and the Becomes picker read well (`.scratch/item-use-and-identity-01/frames/item-properties-uses.jpg`).
- The changelog's two older Inventory entries under 🚧 In Progress still name Consumable and Charges (Items tab, and the Use button). A ticket fragment cannot edit them; fold them into the new Uses entry at close.
- Lowering Uses from 3 to 1 leaves Stackable off, as clearing it does today. Turn it on by hand if the item should stack.
