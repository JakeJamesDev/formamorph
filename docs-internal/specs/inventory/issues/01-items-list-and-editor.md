# 01: Items List And Editor

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a world export-shape change, a generalization of the entity field editors, and the type shapes every later ticket builds on.

## What to build

A world can define Items. The World Editor gets an **Items** list beside Entities and an item editor. The editor reuses the entity field editors (player and AI descriptions, AI Summary, images with Requirement Row rules, image tags, placeholders) after a light generalization, and adds the item fields: value with a unit (a stat or free text), Stackable (on by default), Consumable, charges (a maximum, which turns Stackable off, Q47), Bound, slot and slot size. World settings get a **Slots** list: each slot has a name and a capacity (default 1).

This ticket owns the authored types later tickets use: the Item record, including empty effect-row and equip-requirement lists for 04 and 05 to fill, the Slot record and the Placement record with its tagged `item` source (Q44). Effect rows, equip requirements, scripts and placements get their editors in later tickets.

Spec: Q1, Q8, Q10, Q12, Q13, Q15, Q16, Q32, Q42, Q44, Q46, Q47, Q68; stories 1–10, 26–28, 36–39, 44.

## Acceptance criteria

- [ ] Items, slots and the placement list round-trip through world export and import; a world without them loads unchanged
- [ ] The Items list adds, renames, duplicates, deletes and reorders items, and has a dev-route entry
- [ ] The item editor edits every field above; setting charges turns Stackable off and disables it
- [ ] The value unit picks a stat or takes free text
- [ ] The Slots editor adds, renames, removes slots and sets capacity; an item's slot picker lists them
- [ ] Item image rules use the shared rule cog with a new item rule host
- [ ] Item placeholders resolve once per item per playthrough (Q42)
- [ ] Frames: `.scratch/frames/item-editor-light.png`, `.scratch/frames/item-editor-dark.png` at 1280 wide
- [ ] CONTEXT.md entries for Item, Item Copy, Placement and Slot; the World Editor docs page describes Items and Slots; changelog fragment written

For you: open a world, add an item and a slot, and check the editor reads like the entity editor.

## Blocked by

- None (can start immediately)
