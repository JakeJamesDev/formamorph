# 03: Entity Stats in the World Editor

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Rationale: follows the entity Traits mirror closely; the risk is in the world shape and migration, which have strong prior art.

Parent: [Entity Stats spec](../spec.md)

## What to build

An author adds stats to an entity in the World Editor. The entity panel gets a **Stats** tab, Advanced only, that mirrors the Stats tab for that entity: the shared list toolbar, search, a **+** menu with **Add Stat**, and the full stat editor with every field a world stat has. The world saves, exports and imports with entity stats intact. Rulings Q1, Q7, Q12, Q22.

## Acceptance criteria

- [ ] An entity holds its own stats, each the world stat type with every field.
- [ ] The entity panel's **Stats** tab shows in Advanced mode only and mirrors the Stats tab: toolbar, search, row buttons, reorder inside the entity, details sliding in over the list.
- [ ] **Add Stat** in the **+** menu adds a stat named by the search text, as other lists do.
- [ ] The stat details editor on the entity tab is the same editor the Stats tab uses.
- [ ] World migration fills entities with no stats; export and import round-trip entity stats.
- [ ] Undo, redo and History record entity stat edits and return to the entity Stats tab.
- [ ] The tab has a dev-route entry.
- [ ] Response carries the export-shape reminder.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
