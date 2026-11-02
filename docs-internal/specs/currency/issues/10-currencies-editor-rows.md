# 10: Currencies Editor Rows

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A pattern swap in one editor area, with an existing Design System pattern to copy.

## What to build

An author edits Currencies the way they edit other records that hold ordered rows. Each Currency is an expandable `EditorRow` with an attached body. An Items-backed Currency's rows are a nested `EditorRowList` with its own drag boundary. Drag replaces the arrow buttons at both levels.

The behavior stays: the first Currency is the Default, the rows follow ticket 02's rules, and deletes follow Q22.

Rulings: Q77. Read `docs/Design-System.md`'s row table and the `design-system` skill first.

## Acceptance criteria

- [ ] The Currencies entry and its item rows use `EditorRow` and `EditorRowList`, and no arrow buttons remain.
- [ ] Dragging a Currency changes the Default. Dragging an item row reorders it and keeps each worth and the worth-1 rule.
- [ ] A drag inside a Currency's rows never moves the Currency. A test fails when the nested boundary is removed.
- [ ] Keyboard reordering works as it does in the pattern's other lists.
- [ ] Frames of a collapsed and an expanded Items Currency, in both themes at 1366: `.scratch/frames/currency-rows-light.png`, `currency-rows-dark.png`.
- [ ] Docs that describe the Currencies entry match, and a changelog fragment exists only if a released surface changed.

For you: reorder Currencies and item rows by drag on the Items fixture. Does it feel like the other lists?
