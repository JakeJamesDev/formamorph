# 15: Test Bench Covers Entity Stats

Status: done
Blocked by: 08, 12
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Rationale: extends existing Test Bench lenses with pure, already-built derivations.

Parent: [Entity Stats spec](../spec.md)

## What to build

An author checks entity stats before playing. The Test Bench shows each entity's stats with their derived values and descriptor bands, as it does for the player's stats, including the effects of the entity's traits and Links. It shows computation only, never model judgment (ADR-0005). Derived ruling from Q7.

## Acceptance criteria

- [ ] The Test Bench lists entity stats per entity with derived min, max, regen and starting value.
- [ ] Descriptor bands show for entity stats as for player stats.
- [ ] Trait and Link stat effects show in the derived values.
- [ ] Nothing in the view depends on a model call.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
