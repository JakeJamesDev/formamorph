# 04: Entity Stats in Play

Status: done
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: runtime state, save shape and the stat-code sandbox's exposure all change together; the sandbox rules are strict.

Parent: [Entity Stats spec](../spec.md)

## What to build

Entity stats live through a playthrough. A new game seeds every authored entity's stats. Each turn, regen and stat code run for every entity in the playthrough, present or not. Stat code reads any entity's stats through `entities[x].stats`, read only, and an entity stat's own code reads its owner's stats as `stats`. The save keeps entity stat values and drops those of entities no longer in the playthrough. Rulings Q7, Q9, Q15, Q29, Q38–Q42, and the derived pruning ruling. Morph bindings are ticket 16 (Q43).

## Acceptance criteria

- [ ] A new game seeds each authored entity's enabled stats at their starting values.
- [ ] Before code, regen and after code run for every owner each turn, in today's order.
- [ ] `entities[x].stats` exposes each entity's stats read only; a write from code has no effect.
- [ ] In an entity stat's code, `stats` is its owner's stats. The player's code reads the player's stats as before.
- [ ] The save stores entity stat values keyed by owner. Load drops owners no longer in the playthrough.
- [ ] Gameplay never writes GameDataContext.
- [ ] Response carries the export-shape reminder.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
