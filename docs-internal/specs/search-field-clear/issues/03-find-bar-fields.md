# 03: Find Bar Fields

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: the Find bar is dense, has two layouts, pinned focus semantics, and existing trailing cells; placing the X without breaking the match toggles, the counter, or the collapse flow needs care.

## What to build

The floating Find box and the Replace box each gain the **Clear Search** X as the innermost trailing cell, before the match toggles and before the replace mode swap (Q7). Clearing empties the box and returns focus to it; it does not collapse the bar or drop the match marker.

The docked **Search World** field is unchanged except that its existing close button renames from "Clear search" to **Clear Search** (Q6), with its tests.

Changelog: folds into ticket 01's lead.

## Acceptance criteria

- [ ] Floating Find and Replace show the X while they hold text; the toggles and mode swap keep their edge position.
- [ ] Clearing Find empties the box, keeps the bar open, and focuses the box.
- [ ] The docked close button is named **Clear Search**; the find-expand and Find bar reference tests use the new name.
- [ ] One test per box that the X clears it; no existing assertion is weakened.
- [ ] Four gates green.
