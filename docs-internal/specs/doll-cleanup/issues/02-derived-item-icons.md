# 02: Derived Item Icons

Status: ready-for-agent
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

- [ ] Resolver table tests cover Auto, specific and None, each with and without an image.
- [ ] Resolver tests cover an unidentified Item Copy with each choice. It never shows the authored icon or the Item image.
- [ ] Resolver tests cover an unknown id (reads as Auto), head noun, container words, slot fallback, generic fallback, a non-English name and an item with no name.
- [ ] Catalog test: every word maps to one icon, and every icon has a body and at least one word.
- [ ] Slot Boxes show the resolver's result and no long text. None with no image is a plain filled box with the name in its tooltip.
- [ ] Carried and Here rows show the same result. None with no image shows no icon.
- [ ] THIRD-PARTY-NOTICES.md credits Game Icons with the CC BY 3.0 text, and that entry survives regenerating the file. The ticket reports whether builds ship the file.
- [ ] The Item export type gains `icon?`, and the response carries the export-shape reminder.
- [ ] Frames at 1366 in both themes: `.scratch/frames/icons-light.png`, `.scratch/frames/icons-dark.png`.
- [ ] Docs that describe the Inventory panel match. The changelog fragment says that Item images leave the doll and rows by default.

For you: an existing world with Item images. Is Auto's result acceptable with no author action?
For you: the small boxes (ring, neck) at 1366. Which icons turn muddy?
