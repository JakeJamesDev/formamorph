# 06: Stranger Fields in the World Editor

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An author sets an optional **Stranger Name** and **Stranger Description** on an entity in the World Editor. Both take placeholders and rolls like the entity's other text fields. Help copy explains that an entity without them starts met, and how relationships and Known In picks make a stranger start met.

## Acceptance criteria

- [ ] The entity editor shows Stranger Name and Stranger Description fields and saves them to the entity.
- [ ] Placeholders and rolls work in both fields, as in the entity's other text fields.
- [ ] Help copy follows the Writing Guide. The World Editor docs page describes the fields and the start-met rule.
- [ ] The fields are reachable through a dev route. Frames `.scratch/frames/stranger-fields-light.png` and `.scratch/frames/stranger-fields-dark.png` at 1400 px wide show them.
