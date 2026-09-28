# 10: Links across library and import

Status: ready-for-human
Base: 93424d0d
Blocked by: 08 — Bearers at enter-world and in play
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: extends the portable-traits rebind rule to two more node kinds. Known pattern, several file formats.

Parent: [Trait Links spec](../spec.md)

## What to build

A library persona's links travel with it by name. In another world they rebind by id, then by unique name, and drop when neither matches. Named-scope requirements travel by bearer name. A library persona's links bind at enter-world against the world being entered.

## Acceptance criteria

- [ ] A link off-world (library entity, entity file, character card) stores the original's name. Import binds by id when the origin id exists in the receiving world, then by unique name among world traits and groups, else drops the link. A link whose original the bearer's tree already holds drops too.
- [ ] A named-scope requirement stores the bearer's name off-world and rebinds by the unique-name rule against the receiving world's entities.
- [ ] A library persona's links bind at enter-world against the world being entered, and resolve through the bearer-resolution module from then on.
- [ ] The library entity editor's Traits tab can hold links only when the entity is opened inside a world; standalone it shows existing links read-only with their stored name.
- [ ] Round-trip tests cover links by name, rebind by id then unique name, a dropped link, a dropped duplicate, and a named scope rebound by bearer name, for the library, the entity file and the card.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
