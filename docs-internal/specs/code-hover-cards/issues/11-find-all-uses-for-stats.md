# 11: Find All Uses For Stats

Status: done
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Popover, pinned card and caret reveal on top of owner-route's shared module. Opus at high: cross-box navigation and identity matching. Also blocked outside this spec by owner-route-open-stat-writes ticket 08; do not start until it has landed.

## What to build

A card on a stat shows Find All Uses. Clicking it pins the card, and a popover hangs off it listing every use of that exact stat: one row per box and line, naming the stat and its box (Before or After). Uses come from owner-route ticket 08's shared module, which returns each reference with its box, route, target stat and key range, across every box in the world. A stat's own `self` lines count. A Blueprint box with no bearers is listed, marked No Bearers. A row selects the stat, opens the box and moves the caret to the line; the code session gains a call for that. Escape or a click outside closes both. The template dialog, the Tool editor and the library editor hide Find All Uses.

Spec: Q9, Q21, Q23, Q24, Q31; Implementation Decisions: Find All Uses, Pinned card.

## Acceptance criteria

- [ ] Rows list each box and line; aliases of one stat join; two owners' same-named stats stay apart
- [ ] `self` lines count; a Blueprint box with no bearers shows, marked No Bearers
- [ ] A row jumps to the stat's box at the line
- [ ] The card stays pinned while the popover is open; Escape or a click outside closes both
- [ ] Guards bite: owner separation and alias joining
- [ ] Changelog fragment; four gates green

## Blocked by

- 06
- owner-route-open-stat-writes 08 (outside this spec)
