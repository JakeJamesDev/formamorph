# 04: Doll and Equipped Columns

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Layout work in a busy panel, with a shared popover and measured widths.

## What to build

The Inventory panel shows the doll at about 1/3 of the width and an Equipped list beside it, at every width, mobile included. A Body wider than tall stacks. Each row is one Item Copy: icon from the resolver, name, slot names, and a one-click unequip button. A long name stays on one line with a tooltip. Pressing the name opens the same popover as the doll's Slot Box, and that popover shows the full name.

The doll width from the prototype: `clamp(min(120px, full width), 33%, full width)`. Prototype variant `clamp` on branch `prototype/doll-cleanup`, commit a04717109.

Rulings: Q5, Q12, Q15, V1. Copy for the empty list follows the Writing Guide.

## Acceptance criteria

- [ ] The doll and list sit side by side at 375, 430, 1280, 1366 and 1920, read from the DOM.
- [ ] A Body wider than tall stacks the doll over the list.
- [ ] An All of item shows one row with both slot names.
- [ ] The row's unequip button unequips in one click, and does not open the popover.
- [ ] A Slot Box click still opens its popover.
- [ ] Pressing a row's name opens the same content as the Slot Box, with the full name unclipped.
- [ ] A clipped name shows its full text in a tooltip.
- [ ] An empty slot tap keeps today's behavior.
- [ ] An empty list shows its empty state.
- [ ] Frames: `.scratch/frames/columns-375.png`, `columns-1366.png` and `columns-1920.png` in the light theme, `columns-1366-dark.png` in the dark theme, and `columns-wide-body.png` at 1366.
- [ ] Docs that describe the Inventory panel match, and a changelog fragment exists.

For you: the Inventory panel on your phone. Are the small Slot Boxes acceptable with the list beside them?
