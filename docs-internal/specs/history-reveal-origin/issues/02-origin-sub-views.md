# 02: Origin Sub-Views

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: it extends the seam 01 sets, with sub-tab and view switches the find bar already uses.

Parent: [History Reveal Origin spec](../spec.md)

## What to build

The Origin includes the sub-view: the panel sub-tab (for example Overview's Opening sub-tab or an entity panel tab) and the Locations list or canvas view. Reveal restores it, so an Opening undo lands on the Opening sub-tab, not Overview's first one. On mobile, a reveal of a location edited in the canvas view pushes its detail panel, as a tap does (Q11).

## Acceptance criteria

- [ ] An Opening edit reveals the Overview tab on the Opening sub-tab.
- [ ] An edit on an entity panel sub-tab reveals that sub-tab.
- [ ] An edit in the Locations canvas view reveals the canvas view. An edit in the list view reveals the list view.
- [ ] At mobile width, a canvas-view location reveal pushes the detail panel.
- [ ] A sub-view the editor no longer offers falls back to the tab's default sub-view.
- [ ] Bench tests for each case.
