# 03: Locations View Switch As Icons

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: collapsing a two-branch control into one and moving it to the toolbar's trailing slot, with one harness test.

From the prototype branch `prototype/world-editor-tabs`, commit fdc2f52c.

## What to build

On the Locations tab the List and Canvas switch is two icon buttons with tooltips, "List" and "Canvas", on desktop as it already is on mobile, so one branch serves both layouts (Q8). The switch sits after the search box at the row's right end; the `+` stays beside the search box. Each button's accessible name is its tooltip.

Changelog: one line in the effort's fragment, Minor Added, 👤.

## Acceptance criteria

- [ ] Desktop Locations toolbar order: `+`, search box, then List and Canvas as icon buttons named "List" and "Canvas".
- [ ] Mobile renders the same control from the same branch.
- [ ] Selecting Canvas shows the canvas; selecting List shows the list, as before.
- [ ] Guard bites: restoring the text labels turns the icon-name test red.
- [ ] Changelog fragment line written.
- [ ] Gates green; graph updated.

## Blocked by

- None (can start immediately)
