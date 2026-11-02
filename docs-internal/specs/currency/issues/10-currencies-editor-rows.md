# 10: Currencies Editor Rows

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A pattern swap in one editor area, with an existing Design System pattern to copy.

## What to build

An author edits Currencies the way they edit other records that hold ordered rows. Each Currency is an expandable `EditorRow` with an attached body. An Items-backed Currency's rows are a nested `EditorRowList` with its own drag boundary. Drag replaces the arrow buttons at both levels.

The behavior stays: the first Currency is the Default, the rows follow ticket 02's rules, and deletes follow Q22.

Rulings: Q77. Read `docs/Design-System.md`'s row table and the `design-system` skill first.

## Acceptance criteria

- [x] The Currencies entry and its item rows use `EditorRow` and `EditorRowList`, and no arrow buttons remain. (test "removes rows, and has no arrow buttons")
- [x] Dragging a Currency changes the Default. Dragging an item row reorders it and keeps each worth and the worth-1 rule. (tests "reorders by keyboard drag, so the Default changes" and "reorders rows by keyboard drag inside their Currency")
- [x] A drag inside a Currency's rows never moves the Currency. A test fails when the nested boundary is removed. (ran the test with the nested `EditorDndContext` removed: it failed)
- [x] Keyboard reordering works as it does in the pattern's other lists. (both tests use the keyboard sensor)
- [ ] Frames of a collapsed and an expanded Items Currency, in both themes at 1366: `.scratch/frames/currency-rows-light.png`, `currency-rows-dark.png`.
- [x] Docs that describe the Currencies entry match, and a changelog fragment exists only if a released surface changed. (`docs/World-Editor-Items.md`; Currencies are unreleased, so no fragment)

For you: reorder Currencies and item rows by drag on the Items fixture. Does it feel like the other lists?

## Landed

**Not verified**
- Frames at 1366: the Browser pane showed about 800px, so the right edge of each frame (meta, Delete) is cut off. Dark expanded, dark collapsed and light expanded were saved. No light collapsed frame.

**For you**
- Reorder Currencies and item rows by drag on Emberwatch (Items tab, Currencies). Does it feel like the other lists?
- Each Currency row now shows "Default · Items" style meta, as Bodies does. The ticket did not ask for the mark. Keep it?
- The Currency name field sits in the expanded body, so a collapsed Currency cannot be renamed in place.
