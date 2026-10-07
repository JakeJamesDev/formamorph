# 05: Expand To Find And Replace

Status: ready-for-human
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: an overlay that keeps its slot, focus handoff between two inputs, persistent options and a new visual pattern in the Design System.

## What to build

The docked field gains an expand button. Expanding grows today's full Find and Replace bar over the header from the field's position (variant B). The bar is 36rem wide, centered on the field, and the field's slot keeps its width and height, so the header never reflows. The expanded bar always shows the replace row and the match location.

- Ctrl+H focuses and expands. Ctrl+F while expanded focuses the expanded field and stays expanded.
- The expanded bar's collapse button ("Collapse to search") folds it back and moves focus to the collapsed field. Expanding moves focus to the expanded field.
- Its close button becomes "Clear search": it behaves as Escape does (ticket 04's focus rule).
- Match Case and Match Whole Word stay on after collapse. While collapsed, the field shows an icon for each option that is on; selecting it ("Show match options") expands the bar.
- The expand button's name is "Show options and replace", tooltip "Show options and replace (Ctrl+H)".
- Expanded state lives in the World Editor.

The dev-router gets a way to open the World Editor with the bar expanded. The Compact Find Utility Bar pattern gains the docked field and the expanded overlay, with its reference. The World Editor help page's Find and Replace topic describes the field and the expand button; its route stays.

Changelog fragment: folds into ticket 04's entry (expand to Find and Replace, Ctrl+H).

From the prototype branch `prototype/editor-header-search` (variant B, commits `9fae1fb0` and `91591d7f`).

## Acceptance criteria

- [ ] The expand button and Ctrl+H open the overlay with the replace row; the header's other controls do not move.
- [ ] Collapse returns to the field with the query kept; focus follows each change.
- [ ] Options stay on after collapse, the indicator shows each one, and selecting it expands.
- [ ] Clear search clears, collapses and returns focus by ticket 04's rule.
- [ ] Replace, Replace All with its confirmation, and placeholder replace work from the expanded bar.
- [ ] The dev route opens the expanded bar; the Design System pattern and the help topic match.
- [ ] Four gates green; verified at desktop width in both themes.
