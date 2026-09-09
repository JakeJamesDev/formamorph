# 04: Find And Bench Land On The Owning Tab

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

A contained change to two navigation paths that already exist; the subtlety is ordering the tab switch before the reveal timer.

## What to build

Navigating to a Find hit inside an entity opens the tab that holds the field, then rings the field as today. The entity manager takes the same focus-field hint the Overview panel already takes. Field keys map to tabs: `name`, `aliases[n]`, `type`, `imageTags` open Profile; `playerDescription`, `aiDescription`, `aiSummary` open Descriptions. Replace keeps working on fields in a hidden tab because it edits the record, not the DOM.

The editor's item navigation gains an optional tab hint. Bench findings pass none and land on the persisted tab. The top-level Placeholders tab's owner-node Open passes Placeholders, so it lands on the entity's Placeholders tab.

## Acceptance criteria

- [ ] From Profile, a Find hit in AI-Facing Description opens Descriptions and rings the field.
- [ ] From Descriptions, a Find hit in Image Tags opens Profile and rings the field; a hit in an alias rings the chip.
- [ ] Replace on a field in a hidden tab changes the record.
- [ ] Owner-node Open lands on the entity's Placeholders tab.
- [ ] Bench Open on an entity finding lands on the entity with the persisted tab.
- [ ] World Editor bench-harness tests cover each case; the find-focus suite still passes.
- [ ] Four gates green; graph updated.

## Blocked by

- 03 — Tabbed Entity Panel
