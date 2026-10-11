# 05: Entity Stats in the Stat Request

Status: done
Blocked by: 02, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: wires the derivation callback into the stat pass and must hold the probe bar with entities in the request.

Parent: [Entity Stats spec](../spec.md)

## What to build

The AI records how a turn moved the stats of everyone in the scene. The present entities with enabled stats join the player in the one stat request, each under its own heading and its own schema key. Their changes apply to their own stats. Entities who aren't present stay out of the request. On an endpoint that rejects the schema, entity stats are skipped with a diagnostic. Rulings Q2, Q3, Q4, Q28.

## Acceptance criteria

- [ ] The present entities arrive through the Turn Pipeline's derivation callback after narration, from the participants the narration confirmed.
- [ ] The request renders one section per owner and one schema key per owner, every stat required.
- [ ] Each owner's changes apply to that owner's stats only, max before value.
- [ ] An absent entity is never in the request.
- [ ] The fallback skips entity stats and records a diagnostic.
- [ ] Entity stat rows in the stat panel show this turn's change deltas, as the player's rows do (Q50).
- [ ] The token cap scales with stats and owners.
- [ ] The entity stats probe meets Q28 on the cloud default model and Cydonia for the shipped prompt. Numbers go in the commit body.
- [ ] Q45: on Cydonia, invented player changes no longer rise above C3's. Ticket 02 landed at 81 against C3's 68. A miss here blocks the release and goes to the user.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
