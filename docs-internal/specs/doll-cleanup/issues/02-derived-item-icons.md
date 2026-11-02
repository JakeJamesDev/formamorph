# 02: Derived Item Icons

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Owns the shared catalog and resolver. The fallback rules and the Unidentified rule need careful tests.

## What to build

Filled Slot Boxes show an icon instead of the item's name. Carried and Here rows show the same icon. Every item works with no author action: Auto derives from the name, then the slot, then the generic icon. AI-created and blank items use the same path.

This ticket owns the catalog and the icon resolver. Tickets 03 and 04 call them and build no copy of their own. The resolver reads `Item.icon` in full (specific, None, absent), and the type is added here, although no editor writes it until ticket 03.

Start from the prototype's catalog data and its `iconFromName`, `iconFromSlots` and `pickIcon` on branch `prototype/doll-cleanup`, commit a04717109. Drop the lucide column and the variant switches. Note that the prototype's order put the image ahead of Auto. The rulings do not: Auto beats the Item image.

Rulings: Q1, Q3, Q4, Q6, Q7, Q9, Q10, Q11, Q13.

## Acceptance criteria

- [x] Resolver table tests cover Auto, specific and None, each with and without an image. `itemIcons.test.ts`, `resolveItemIcon`.
- [x] Resolver tests cover an unidentified Item Copy with each choice. It never shows the authored icon or the Item image. `itemIcons.test.ts`; mutation of each guard went red.
- [x] Resolver tests cover an unknown id (reads as Auto), head noun, container words, slot fallback, generic fallback, a non-English name and an item with no name. `itemIcons.test.ts`, `deriveItemIcon`.
- [x] Catalog test: every word maps to one icon, and every icon has a body, an author (Q16) and at least one word. `itemIcons.test.ts`, `the catalog`.
- [x] Slot Boxes show the resolver's result and no long text. None with no image is a plain filled box with the name in its tooltip. `InventoryTab.icons.test.tsx`; DOM read of all 10 boxes on the dev route at 1366.
- [x] Carried and Here rows show the same result. None with no image shows no icon. `InventoryTab.icons.test.tsx`; DOM read of the rows.
- [x] THIRD-PARTY-NOTICES.md credits Game Icons with the CC BY 3.0 text, and that entry survives regenerating the file. The ticket reports whether builds ship the file. No build shipped it before this ticket. `shipNotices` now emits it, and a real `vite build` wrote it at the output root (568 KB). No generator exists in the repo, so a test fails if the entry leaves the file or its authors drift from the catalog.
- [x] The Item export type gains `icon?`, and the response carries the export-shape reminder. `parseItems` keeps it through its spread; no editor writes it until ticket 03.
- [x] Frames at 1366 in both themes: `.scratch/doll-cleanup-02/frames/icons-light.png`, `.scratch/doll-cleanup-02/frames/icons-dark.png`.
- [x] Docs that describe the Inventory panel match. The changelog fragment says that Item images leave the doll and rows by default. How-to-Play, Design-System, WorldFormat.

## Landed

**Rulings Q16 and Q17, built here:** the notices file ships in `dist/`, and a Main Menu footer line opens **Icon Credits**. A Playwright run opened it from the footer at 1366 and from the ⋯ menu at 375. At 800 the line wraps, and the footer doesn't overflow. Each icon's author came from its folder in game-icons/icons. Six names that two authors share were resolved by matching the art.

**Not verified:** nothing from the list above.

**For you:**
- For you: an existing world with Item images. Is Auto's result acceptable with no author action?
- For you: the small boxes (ring, neck) at 1366. Which icons turn muddy? `.scratch/doll-cleanup-02/frames/doll-light.png`, `.scratch/doll-cleanup-02/frames/doll-dark.png`.
- For you: the footer credit line's length and wording. `.scratch/doll-cleanup-02/frames/credit-footer.png`, `.scratch/doll-cleanup-02/frames/icon-credits-dialog.png`.
