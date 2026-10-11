# 08: Owned Traits Change Their Bearer's Stats

Status: done
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: changes how trait stat effects resolve per bearer, a rule the player's stats must not feel.

Parent: [Entity Stats spec](../spec.md)

## What to build

An entity's own traits, and the trait Links it bears, change its own stats: min, max, starting value, regen, and toggles. This keeps the trait-gates spec's promise. A trait stat change on a stat its bearer doesn't own has no effect, and the World Editor flags it. An NPC's trait never changes the player's stats. Rulings Q8, Q23.

## Acceptance criteria

- [ ] Owned traits and trait Links may carry stat changes and toggles in the editor.
- [ ] Each bearer's effective stats derive from its own traits in force, by the same step the player uses.
- [ ] A stat change targets the bearer's own stat by id; a change with no target is dropped.
- [ ] The World Editor flags a trait stat change with no target on its bearer.
- [ ] The player's effective stats are unchanged by any NPC's traits.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
