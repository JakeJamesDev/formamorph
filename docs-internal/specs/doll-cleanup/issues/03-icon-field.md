# 03: Icon Field in the Item Editor

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

One new editor control. It needs design-system and copy care, not new logic.

## What to build

An author opens an Icon field on an Item and sees a searchable grid of the catalog. Auto is the default and shows the icon the current name derives, updating as the name changes. The author can pick a specific icon or None. None brings the Item image back on the doll and in rows.

Rulings: Q1, Q2, Q3, Q9, Q10. Search uses the catalog's words, so "blade" can find a sword. Read the Writing Guide before writing labels, and follow the design system. A new visual pattern needs the user's approval.

## Acceptance criteria

- [x] A new Item reads Auto and writes no `icon` value. `WorldEditor.itemIcon.test.tsx`.
- [x] Auto shows the derived icon and updates when the name changes. `WorldEditor.itemIcon.test.tsx`, with the slot fallback and an unknown id.
- [x] Picking an icon writes its id. Picking None writes `'none'`. Picking Auto removes the value. `WorldEditor.itemIcon.test.tsx`; each write's mutation went red.
- [x] Search finds an icon by a word in the catalog, and shows a clear result when nothing matches. `WorldEditor.itemIcon.test.tsx`, `searchItemIcons`; live, "blade" gave Sword.
- [x] A chosen icon or None shows on the doll and in rows in play. `InventoryTab.icons.test.tsx`, from ticket 02, reads `item.icon` through the resolver. Not driven end to end from the editor into a game.
- [x] A world export and import keeps the choice. `items.test.ts`, through JSON and `parseItems`.
- [x] The field works inside the editor's scroll and dialog layers, with wheel scroll in the grid. Playwright at 1366 in both themes: a wheel moved the grid 300px, and the popover stayed inside the viewport.
- [x] Undo restores the previous choice. `WorldEditor.itemIcon.test.tsx`, back to Auto and back to an icon.
- [x] Frames of the open grid at 1366 in both themes: `.scratch/doll-cleanup-03/frames/icon-grid-light.png`, `.scratch/doll-cleanup-03/frames/icon-grid-dark.png`.
- [x] Docs that describe Items name the field, and a changelog fragment exists. `World-Editor-Items.md`, `Design-System.md`; `WorldFormat.md` already names it.

## Landed

**The user approved the grid pattern** from frames on 2026-11-02, as the spec session ruled. The Design-System entry and the showcase item (`#dev?modal=designSystem&tab=icon-grid-picker`) ship here.

**Build choices no ruling names:**
- Search matches the start of a catalog word, so "dag" finds the dagger and not the bandage.
- The catalog's `Fallback` group reads "Other" in the grid, below the fold of the frames the user approved.
- Two quick picks inside the history pause fold into one Undo step, as with every other field.

**Not verified:** nothing from the list above.

**For you:**
- For you: pick icons for a few items in your own world. Is 67 enough, and which icons are missing?
