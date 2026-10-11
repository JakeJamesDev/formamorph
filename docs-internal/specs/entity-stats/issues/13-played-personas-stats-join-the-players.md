# 13: Played Persona's Stats Join the Player's

Status: done
Blocked by: 05, 06, 12
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the persona sits on both sides of the owner line; request keys, panel and stat code must agree on one identity.

Parent: [Entity Stats spec](../spec.md)

## What to build

When the player plays an authored entity, its stats become the player's stats, as its owned traits become the player's traits. They show in the player's part of the stat panel beside the world's player stats and the AI updates them as the player's. A persona stat that shares a name with a world player stat stays a separate stat. Values are kept when the player switches persona and back. Rulings Q11, Q16.

## Acceptance criteria

- [ ] The played persona's owned and linked stats join the player's stats while it is played.
- [ ] A same-named persona stat and world player stat are two stats in the panel, the request and stat code.
- [ ] The stat request tells the two apart, and each change lands on the right one.
- [ ] Switching persona and back keeps every entity's stat values.
- [ ] On load, a library persona's stats backfill as Q40 rules for every owner: a stat its library entry gained since the save is added at its starting value (Q74).
- [ ] The join covers a library persona as well as a world one (Q67). Whichever of tickets 13 and 14 lands second adds the test for a library persona.
- [ ] A persona that owns a stat with a world player stat's id (Q58): the trait stat picker shows each stat once, a trait can still reach the world stat, and no false "player stat changes" or toggle-conflict note shows.
- [ ] The played persona is never an entity owner in the request. In the panel's dropdown it stays "<name> (You)", and picking it shows no entity section (Q49).

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
