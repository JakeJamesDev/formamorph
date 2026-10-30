# 07: Planner Casts Strangers by Stranger Name

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The turn planner casts an entity that has a Stranger Name under that name as its alias until the player meets it. Prose and panels then agree from the first turn, and the true name does not slip early. The narrator keeps receiving aliases through the planner.

## Acceptance criteria

- [ ] The planner prompt names an unmet entity that has a Stranger Name by that name as its alias.
- [ ] A probe on cloud with in-batch controls, old prompt against new with at least 5 runs per arm, reports how often the true name leaks and how often the alias matches the Stranger Name. The numbers go in the landing message.
- [ ] Met entities, and entities without a Stranger Name, are cast as today.

For you: play Emberwatch with a stranger authored, and read whether the narration keeps the stranger's name hidden until they are introduced.
