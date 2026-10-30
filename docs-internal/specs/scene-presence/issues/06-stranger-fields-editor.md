# 06: Stranger Fields in the World Editor

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An author sets an optional **Stranger Name** and **Stranger Description** on an entity in the World Editor. Both take placeholders and rolls like the entity's other text fields. Help copy explains that an entity without them starts met, and how relationships and Known In picks make a stranger start met.

## Acceptance criteria

- [x] The entity editor shows Stranger Name and Stranger Description fields and saves them to the entity. `EntityFields.stranger.test.tsx`; DOM read in the dev route.
- [x] Clearing either field stores it as absent, never as an empty string (spec Q48). Tests for both fields and whitespace; the guard fails when the rule is removed.
- [x] Placeholders and rolls work in both fields, as in the entity's other text fields. Both use `PlaceholderNameField` and `PlaceholderField` with the entity's `ownerId`.
- [x] Help copy follows the Writing Guide. The World Editor docs page describes the fields and the start-met rule. Help topic `worldEditor.strangerName` and the "Strangers" docs section.
- [x] The fields are reachable through a dev route. Frames `.scratch/frames/stranger-fields-light.png` and `.scratch/frames/stranger-fields-dark.png` at 1400 px wide show them. Route: `#dev?modal=worldEditor&tab=entities&subtab=profile&fixture=entityPresence`, Advanced mode.

## Landed

**Not verified**

- Placeholder and roll insertion in the new fields was not driven by hand. The tests mock the chip editors, which other entity fields share.

**For you**

- Stranger Name hint and help topic copy: read them in the Profile tab (Advanced) and the Help button beside the label.
- Export shape: `strangerName` and `strangerDescription` are additive optional world-entity fields.
