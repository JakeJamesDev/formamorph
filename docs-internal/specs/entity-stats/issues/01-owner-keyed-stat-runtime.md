# 01: Owner-Keyed Stat Runtime

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a prefactor across the stat derive, regen, apply and stat-code paths. Every later ticket builds on its shape, and the parity net must stay byte-equal.

Parent: [Entity Stats spec](../spec.md)

## What to build

The stat runtime learns that stats have an owner. Deriving effective stats, regen, applying a stat response and the stat-code turn each take an owner and its stats, and the player is the only owner. A player sees no change: every turn produces the same requests and the same values as before. This makes room for entity stats without changing behavior.

## Acceptance criteria

- [ ] Effective-stat derivation, regen, response apply and the stat-code turn work on one owner's stats, given that owner's traits in force.
- [ ] Runtime stat values are addressable by owner and stat id. The player's values keep their current save shape in this ticket.
- [ ] The turn-pipeline parity suite passes with byte-equal request bodies.
- [ ] Existing trait-runtime, stat-code-turn and stat-request tests pass unchanged. Any changed assertion has a stated reason in the commit body.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
