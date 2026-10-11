# 14: Library Characters Carry Their Stats

Status: done
Blocked by: 04, 09, 12
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Rationale: follows how library characters already carry owned traits; the risk is the card format.

Parent: [Entity Stats spec](../spec.md)

## What to build

A library character brings its stats into any world. The character card carries the entity's owned stats, stat Links and stat groups. A library persona, or a library character added to a world, plays with its stats like an authored entity. Ruling Q20.

## Acceptance criteria

- [ ] Character card export and import carry owned stats, stat Links and stat groups.
- [ ] A library character added to a world has its stats in play, in the request when present, and in the panel.
- [ ] A library persona's stats join the player's as in ticket 13.
- [ ] Card migration fills cards with no stats.
- [ ] Response carries the export-shape reminder.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
