# 05: Item Condition: State and Identity

Status: ready-for-human
Blocked by: 02, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A Requirement Row that checks an item can also require a State word, and require the item identified or unidentified. Both are optional and combine with Not. Traits, image rules and equip requirements all read the same check, so a lantern can grant Darkvision only while its State is "lit".

Spec: What each reader shows (Requirement Rows); Q22.

## Acceptance criteria

- [x] An item row can set a State word; it holds only for a matching copy (`traitGates.item.test.ts`: State word, same-copy test; mutation of the check failed 4 tests)
- [x] An item row can require identified or unidentified (`traitGates.item.test.ts`: identified or unidentified)
- [x] Both combine with owned or equipped, the owner, and Not (`traitGates.item.test.ts`: owner and Not, same copy)
- [x] The Requirement Row editor shows both fields on an item row (`RequirementRowsField.item.test.tsx`: fields, State write, identity set and clear)
- [x] Requirement text that names a required item uses its unidentified face while the owner holds no identified copy (Q45) (`traitGates.item.test.ts`: unidentified face)
- [x] The glossary entry for Item Condition and the wiki page that documents Requirement Rows describe the new checks (`CONTEXT.md`, `docs/World-Editor-Traits.md`)

## Blocked by

- 02
- 03

## Landed

**Not verified**

- Looks of the State field and Identity select in the item chip: no frame taken, tested by DOM reads only.

**For you**

- Add a trait Requirement with an Items row. Check that **State** and **Identity** sit well on the chip, in both themes and at a narrow width.
- Equip requirements and image rules read the checks too. A refused equip names the item by the unidentified face when the owner holds no identified copy.
