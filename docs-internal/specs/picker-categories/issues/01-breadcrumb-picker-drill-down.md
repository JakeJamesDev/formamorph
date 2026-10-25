# 01: Breadcrumb Picker Drill-Down

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A shared component gains a page stack, two search scopes, pass-through rules and keyboard drill. It sets the tree shape ticket 02 builds on, so Opus.

## Parent

`docs-internal/specs/picker-categories/spec.md`

## What to build

The Breadcrumb Picker gets an opt-in tree input beside its flat sections (spec Q1). A tree node is a page (a heading and child nodes) or a leaf section of rows. A picker with no tree behaves exactly as today. This ticket owns the tree type; ticket 02 only consumes it.

With a tree and more than 15 leaf rows, the picker opens on the root page (Q5). Each page row shows the name, then a chevron, in DrillPicker's look, and a count of enabled leaf rows under it in the hint slot (Q12, Q14, Q16). Clicking a page row, or Enter on it, opens that page under the owner page's back-arrow header. The back arrow, or a back key, returns one level.

- A page with one child opens straight through it; the header names the skipped page (Q7).
- A category with one leaf row shows that row at the root, pickable at once (Q8).
- With 15 leaf rows or fewer, the picker shows today's flat list from the same rows (Q4).
- Root search reads every leaf row and shows the flat list with full breadcrumbs (Q2). Page search reads only rows under the open page (Q9). Opening a page starts with an empty search.
- On a page, a row's breadcrumb drops the segments the page path already shows (Q13).
- A pick leaves the open page as it is (Q10). A caller `page` still replaces the list, and when it closes the picker shows the page on top of the stack.
- The picker opens at the root every time (Q11).
- Page rows announce that they open a page and their count to a screen reader.

Ship with it: a drill-down example in the Breadcrumb Picker reference of the design-system showcase.

## Acceptance criteria

- [x] A picker with no tree renders and behaves as before; the existing picker tests pass unchanged. (The earlier `breadcrumb-picker.test.tsx` cases are unedited and green, and so are the RequirementRowsField tests.)
- [x] With a tree over 15 leaf rows, the picker opens on the root page; at 15 or fewer it shows the flat list. (Tests: "shows the flat list from the tree at 15 rows" and "opens on the root page above 15 rows".)
- [x] Page rows show a count that leaves out disabled rows. (Test: "opens on the root page above 15 rows". An all-disabled page reads 0.)
- [x] A one-child page opens straight through, and its header names the skipped page. (Tests: "opens straight through a page with one choice" and, for Q18, "opens straight into a lone root category".)
- [x] A one-row category is picked at the root without opening a page. (Test: "picks a one-row category at the root". For Q17 on a page: "opens a page on click".)
- [x] Back returns one level, by the arrow and by keyboard. (Tests: "goes back one level by the arrow" and "drills with Enter and goes back with Backspace".)
- [x] Root search finds rows on every page with full breadcrumbs; page search finds only that page's rows. (Tests: "searches every page from the root" and "searches only the open page".)
- [x] Rows on a page drop the breadcrumb segments the page path shows. (Test: "opens a page on click … drops the path from row breadcrumbs".)
- [x] A pick keeps the open page; a caller page returns to it when closed; reopening starts at the root. (Tests: "stays on the open page after a pick", "returns to the open page and its search" and "opens at the root every time".)
- [x] Each rule above has a rendered picker test, and each test fails when its rule is broken. (Two mutation runs, 21 mutations in total. Each one turned its own test red.)
- [x] The showcase shows a drill-down example: `.scratch/frames/showcase-drill-root.png` and `.scratch/frames/showcase-drill-page.png`, light and dark, at desktop width. (Frames: `.scratch/picker-categories-01/frames/showcase-drill-root.png` and `showcase-drill-page.png`, plus their `-dark` twins. The page frame shows Traits › Rook.)

## Landed

**Not verified**

- None.

**For you**

- For you: open the showcase's Breadcrumb Picker example and check that the drill feels like the Chip Options picker.
- The Requires owner page now uses the shared `BreadcrumbPickerHeader`. Check that it looks the same as before.
