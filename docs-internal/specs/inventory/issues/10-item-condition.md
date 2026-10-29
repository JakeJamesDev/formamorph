# 10: Item Condition

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: a mechanical union extension across about a dozen switch sites, guided by the type checker.

## What to build

Requirement Rows gain an **Item Condition**: an item, owned or equipped, an optional owner, and the Not flag (Q34). It works in trait gates and in image rules. The gate evaluator gets a new input carrying each owner's Item Copies, read through 02's owner query helper. Hidden owned Item Copies count (Q63). On an item, a Condition with no owner means the Item Copy's owner, and is empty while it lies at a location (Q67). The Test Bench and the code hover cards know the new kind.

Spec: Q34, Q63, Q67; stories 85–88.

## Acceptance criteria

- [x] The Requirement Row editor adds an Item Condition with item, owned or equipped, owner and Not — `traitGates.item.test.ts` "offers each item as owned, and as equipped when it fits a slot" (Persona and entity owners); picker code in `RequirementRowsField`; not looked at in the UI
- [x] An Automatic trait that requires a cursed ring turns on when the ring is owned and off when it leaves — "turns an Automatic trait on when the ring is owned and off when it leaves"
- [x] An equipped Condition fails while the item is only carried — "fails an equipped Condition while the item is only carried" (mutation-tested)
- [x] A hidden owned Item Copy satisfies the Condition — "counts a hidden Item Copy (Q63)"
- [x] An owner-less Condition in an item image rule reads the Item Copy's owner — `itemRuleStates` tests; the location case is mutation-tested; nothing renders item images in play yet
- [x] Item Conditions export with the world and rebind by name in entity files — "entity files" tests (card round trip, rebind by name); the world export holds the Condition as plain data
- [x] CONTEXT.md's Condition entry lists the Item kind; the traits docs page describes it; changelog fragment written — `CONTEXT.md`, `docs/World-Editor-Traits.md` Item conditions, `docs-internal/changelog.d/inventory-10.md`
- [x] An owner-less stat Condition in an item rule targets the Item Copy's owner; the editor stops offering Global stats as its own section there (from ticket 01's landing) — `itemRuleStates` and `itemHostStatSections` tests

## Blocked by

- 02

## Landed

**Not verified**

- Nothing renders an item's image rules in play yet, so `itemRuleStates` has no caller outside tests. The play-time item image view needs to call it with the Item Copy.
- The picker's **Items** category, the item chip and the **Item Owner** stat section were not looked at in the UI.
- Paged-back turns read the live Item Copies: the save keeps no per-turn list.
- The Test Bench reports an item Condition on a missing item as unresolved through the gate states. It has no rule of its own for item gates, and `neverUnlockable` counts every item Condition as able to hold.

**For you**

- A hidden owned item's name can show in a locked trait's gate line for the player. Check whether that should be hidden. (Traits panel, a trait that requires a hidden item)
- This changes the export shape of world and entity `.json` files: Requirement Rows can hold `kind: 'item'` with `status`.
