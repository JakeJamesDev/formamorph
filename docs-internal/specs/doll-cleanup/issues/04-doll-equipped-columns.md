# 04: Doll and Equipped Columns

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Layout work in a busy panel, with a shared popover and measured widths.

## What to build

The Inventory panel shows the doll at about 1/3 of the width and an Equipped list beside it, at every width, mobile included. A Body wider than tall stacks. Each row is one Item Copy: icon from the resolver, name, slot names, and a one-click unequip button. A long name stays on one line with a tooltip. Pressing the name opens the same popover as the doll's Slot Box, and that popover shows the full name.

The doll width from the prototype: `clamp(min(120px, full width), 33%, full width)`. Prototype variant `clamp` on branch `prototype/doll-cleanup`, commit a04717109.

Rulings: Q5, Q12, Q15, V1. Copy for the empty list follows the Writing Guide.

## Acceptance criteria

- [x] The doll and list sit side by side at 375, 430, 1280, 1366 and 1920, read from the DOM. Playwright rects: doll 120, 123, 120, 120, 145 wide, list to its right, no page overflow.
- [x] A Body wider than tall stacks the doll over the list. DOM read on Hound: list top below doll bottom; test `a Body of aspect 1.01 lays out as stacked`. A square Body takes columns (spec session).
- [x] An All of item shows one row with both slot names. Test `shows an All of item once`; DOM read "Main Hand, Off Hand".
- [x] The row's unequip button unequips in one click, and does not open the popover. Test `unequips in one click, with no popover`; Playwright click: 0 dialogs, row gone.
- [x] A Slot Box click still opens its popover. Playwright click on the Main Hand box.
- [x] Pressing a row's name opens the same content as the Slot Box, with the full name unclipped. Test `opens the same popover from the row name and the Slot Box`; Playwright: same text, name not cut.
- [x] A clipped name shows its full text in a tooltip. Tests `shows a cut name in full` and `shows no tooltip for a name that fits`; Playwright hover.
- [x] An empty slot tap keeps today's behavior. Playwright: tap on an empty Waist box flashes "Waist"; existing test `shows the slot name on a tap`.
- [x] An empty list shows its empty state. Test `shows the empty state with nothing equipped`.
- [x] Frames: `.scratch/frames/columns-375.png`, `columns-1366.png` and `columns-1920.png` in the light theme, `columns-1366-dark.png` in the dark theme, and `columns-wide-body.png` at 1366. Taken with Playwright; the wide frame reverses the fixture's Bodies through a request route.
- [x] Docs that describe the Inventory panel match, and a changelog fragment exists. How-to-Play, Design-System, the showcase hints, and the fragment `doll-equipped-columns.md`.

## Landed

**Not verified**

- Nothing unticked. Touch on a real phone is the For-you line below; Playwright ran with touch on at mobile widths but pressed with a pointer.

**For you**

- For you: the Inventory panel on your phone. Are the small Slot Boxes acceptable with the list beside them?
- Frames: `.scratch/doll-cleanup-04/frames/columns-375.png`, `.scratch/doll-cleanup-04/frames/columns-1366.png`, `.scratch/doll-cleanup-04/frames/columns-1920.png`, `.scratch/doll-cleanup-04/frames/columns-1366-dark.png`, `.scratch/doll-cleanup-04/frames/columns-wide-body.png`, `.scratch/doll-cleanup-04/frames/columns-popover.png`.
- At 1280, all 9 rows of the bigger fixture clip their names (8 in the prototype): the row's icon is 24px, the prototype's 20px. Is that acceptable at that width?

**Follow-ups**

- Carried and Here rows cut long names with no tooltip. Q5 covers Equipped rows only (spec session ruling).
