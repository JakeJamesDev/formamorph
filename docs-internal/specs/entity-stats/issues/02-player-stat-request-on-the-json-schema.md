# 02: Player Stat Request on the JSON Schema

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a request-layer change with capability detection, a fallback path and a prompt change that must clear a probe bar on two models.

Parent: [Entity Stats spec](../spec.md)

## What to build

The player's stat pass switches to the C3 shape. The stat request sends a JSON schema: one key per owner (only the player for now), every stat present, each with a change and an optional max change, 0 for no change. The default Stat Updates prompts change to the C3 wording. An endpoint that rejects the schema is remembered, and its turns fall back to today's player-only text pass with a diagnostic. Rulings Q3, Q4, Q10, Q24, Q28.

## Acceptance criteria

- [ ] The request layer can send a structured-output schema. The schema uses no keyword the cloud server rejects.
- [ ] The stat request's schema lists every enabled player stat as required, with a bounded change and an optional bounded max change.
- [ ] The response reader matches stats by identity from the request snapshot and returns updates and diagnostics. A max change applies before the value change.
- [ ] The default system and user Stat Updates prompts carry the C3 wording: one JSON object on one line, 0 for an unmoved stat, a shift in how a character regards the player counts. A custom prompt is left as written and still gets the schema.
- [ ] A schema rejection is remembered per endpoint through the existing capability pattern. Those turns use today's text pass and add a diagnostic.
- [ ] The token cap scales with the stat count.
- [ ] The entity stats probe's player-cell numbers for the new request, including the max slot, meet Q28 on the cloud default model and Cydonia, with today's pass as the in-batch control. Numbers go in the commit body.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
