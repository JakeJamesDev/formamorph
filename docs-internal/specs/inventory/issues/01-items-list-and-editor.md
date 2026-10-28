# 01: Items List And Editor

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a world export-shape change, a generalization of the entity field editors, and the type shapes every later ticket builds on.

## What to build

A world can define Items. The World Editor gets an **Items** list beside Entities and an item editor. The editor reuses the entity field editors (player and AI descriptions, AI Summary, images with Requirement Row rules, image tags, placeholders) after a light generalization, and adds the item fields: value with a unit (a stat or free text), Stackable (on by default), Consumable, charges (a maximum, which turns Stackable off, Q47), Bound, slot and slot size. World settings get a **Slots** list: each slot has a name and a capacity (default 1).

This ticket owns the authored types later tickets use: the Item record, including empty effect-row and equip-requirement lists for 04 and 05 to fill, the Slot record and the Placement record with its tagged `item` source (Q44). Effect rows, equip requirements, scripts and placements get their editors in later tickets.

Spec: Q1, Q8, Q10, Q12, Q13, Q15, Q16, Q32, Q42, Q44, Q46, Q47, Q68; stories 1–10, 26–28, 36–39, 44.

## Acceptance criteria

- [x] Items, slots and the placement list round-trip through world export and import; a world without them loads unchanged — `WorldEditor.itemsListEditor.test.tsx` "come back out of the editor exactly as they went in" and "leave a world without them unchanged" (mutation-tested)
- [x] The Items list adds, renames, duplicates, deletes and reorders items, and has a dev-route entry — `WorldEditor.itemsListEditor.test.tsx` list cases; reorder by a real Playwright drag on the dev route; `worldEditor&tab=items`, `worldEditorItem` subtabs, `fixture=items`, guarded in `devRouter.test.ts`
- [x] The item editor edits every field above; setting charges turns Stackable off and disables it — item panel cases in `WorldEditor.itemsListEditor.test.tsx` (charges case mutation-tested)
- [x] The value unit picks a stat or takes free text — "takes a value with a free-text unit", "points the value unit at a stat"
- [x] The Slots editor adds, renames, removes slots and sets capacity; an item's slot picker lists them — Slots section cases and "lists the world slots in its slot picker…"
- [x] Item image rules use the shared rule cog with a new item rule host — `ImageTagsField.rules.test.tsx` "Gallery Visibility rules on an item"
- [x] Item placeholders resolve once per item per playthrough (Q42) — `PlaceholderSessionContext.test.tsx` item case (mutation-tested); item home in `placeholderHomes.items.test.ts`
- [x] Frames: `.scratch/frames/item-editor-light.png`, `.scratch/frames/item-editor-dark.png` at 1280 wide — Playwright, 1280×860, Properties tab
- [x] CONTEXT.md entries for Item, Item Copy, Placement and Slot; the World Editor docs page describes Items and Slots; changelog fragment written — `CONTEXT.md`, `docs/World-Editor-Items.md` (+ hub, Home, sidebar), `docs-internal/changelog.d/inventory-01.md`

For you: open a world, add an item and a slot, and check the editor reads like the entity editor.

## Blocked by

- None (can start immediately)

## Landed

**Not verified**

- None of the acceptance criteria. Review notes for later tickets:
  - An item rule's owner-less stat Condition offers Global stats as its own section, since no owner exists in the editor. Ticket 10 owns the Item Condition owner semantics (Q67).
  - Deleting a stat leaves an item's `valueUnit` pointing at it; the picker then shows a blank. Entities have the same gap for stat references.
  - Item images generate tags with the `character` subject. An item subject needs its own guidance and probe numbers.
  - Code paths to item placeholders (`items["Lamp"].placeholders…`) name the `items` global, which scripts reach once ticket 11 lands.

**For you**

- Open a world, add an item and a slot, and check the editor reads like the entity editor. (`#dev?modal=worldEditor&tab=items&fixture=items`)
- Frames: `.scratch/inventory-01/frames/item-editor-light.png`, `.scratch/inventory-01/frames/item-editor-dark.png`
- The Slots section sits on the Overview tab's left column, below Starts On (Q70).
