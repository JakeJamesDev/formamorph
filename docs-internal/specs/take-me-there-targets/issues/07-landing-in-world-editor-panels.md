# 07: Landing in World Editor Panels

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Spec: [spec.md](../spec.md), rulings Q4, Q5.

## What to build

World Editor panels and the Test Bench land targets with the shared hook. Every how-to section on the World Editor pages, the Stat Code guide, Test Bench and World Format that ends at a control gets its target and registry entry. Targets name controls the request can reach without an item (a panel's toolbar, a field in the open panel), never a specific entity or location.

## Acceptance criteria

- [ ] Each World Editor panel and the Test Bench land a target: scroll, focus, pulse once; a missing target lands silently
- [ ] Every how-to section on the listed pages that works from a control present when the surface opens carries a target. The report-only check lists only sections that end at a menu item, inside a dialog the request cannot open, or inside an item's panel (Q11):
  - Menu item: Make a Blueprint.
  - Dialog: Import a SillyTavern Card, Save or Discard Your Changes (it ends in the Unsaved changes dialog).
  - Item panel or list item: Connect Two Locations, Set a Pick Count, Link to a Blueprint, Override a Linked Trait, Weight Values, Pin a Value, Override a Copy.
  - Left to ticket 05: How to Edit a World File by Hand (World Format), whose control is on the Library Worlds tab.
- [ ] Docs checks and existing surface tests stay green
