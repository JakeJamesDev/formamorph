# 10: Item Condition

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: a mechanical union extension across about a dozen switch sites, guided by the type checker.

## What to build

Requirement Rows gain an **Item Condition**: an item, owned or equipped, an optional owner, and the Not flag (Q34). It works in trait gates and in image rules. The gate evaluator gets a new input carrying each owner's Item Copies, read through 02's owner query helper. Hidden owned Item Copies count (Q63). On an item, a Condition with no owner means the Item Copy's owner, and is empty while it lies at a location (Q67). The Test Bench and the code hover cards know the new kind.

Spec: Q34, Q63, Q67; stories 85–88.

## Acceptance criteria

- [ ] The Requirement Row editor adds an Item Condition with item, owned or equipped, owner and Not
- [ ] An Automatic trait that requires a cursed ring turns on when the ring is owned and off when it leaves
- [ ] An equipped Condition fails while the item is only carried
- [ ] A hidden owned Item Copy satisfies the Condition
- [ ] An owner-less Condition in an item image rule reads the Item Copy's owner
- [ ] Item Conditions export with the world and rebind by name in entity files
- [ ] CONTEXT.md's Condition entry lists the Item kind; the traits docs page describes it; changelog fragment written
- [ ] An owner-less stat Condition in an item rule targets the Item Copy's owner; the editor stops offering Global stats as its own section there (from ticket 01's landing)

## Blocked by

- 02
