# 03: Icon Field in the Item Editor

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

One new editor control. It needs design-system and copy care, not new logic.

## What to build

An author opens an Icon field on an Item and sees a searchable grid of the catalog. Auto is the default and shows the icon the current name derives, updating as the name changes. The author can pick a specific icon or None. None brings the Item image back on the doll and in rows.

Rulings: Q1, Q2, Q3, Q9, Q10. Search uses the catalog's words, so "blade" can find a sword. Read the Writing Guide before writing labels, and follow the design system. A new visual pattern needs the user's approval.

## Acceptance criteria

- [ ] A new Item reads Auto and writes no `icon` value.
- [ ] Auto shows the derived icon and updates when the name changes.
- [ ] Picking an icon writes its id. Picking None writes `'none'`. Picking Auto removes the value.
- [ ] Search finds an icon by a word in the catalog, and shows a clear result when nothing matches.
- [ ] A chosen icon or None shows on the doll and in rows in play.
- [ ] A world export and import keeps the choice.
- [ ] The field works inside the editor's scroll and dialog layers, with wheel scroll in the grid.
- [ ] Undo restores the previous choice.
- [ ] Frames of the open grid at 1366 in both themes: `.scratch/frames/icon-grid-light.png`, `.scratch/frames/icon-grid-dark.png`.
- [ ] Docs that describe Items name the field, and a changelog fragment exists.

For you: pick icons for a few items in your own world. Is 67 enough, and which icons are missing?
