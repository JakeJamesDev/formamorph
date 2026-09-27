# 09: Linked traits in AI context

Status: ready-for-agent
Blocked by: 08 — Bearers at enter-world and in play
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: prompt-text changes over an existing owned-trait path, plus probe runs. Small code, careful measurement.

Parent: [Trait Links spec](../spec.md)

## What to build

The narrator knows Albus is a Paladin. A cast entity's active linked traits join its entity context like owned traits, and `{{char}}` in any trait's text names the bearer.

## Acceptance criteria

- [ ] A cast entity's active linked traits join its entity context the same way as owned traits: full text in the full context, names in the summary. The played bearer's linked traits join the player's trait context.
- [ ] `{{char}}` in a trait's text reads as the bearer's name. On the Custom Persona bearer under None it reads as the player name, as `{{user}}` does. The in-play trait card resolves the same way.
- [ ] Roll priming walks linked trait names and descriptions per bearer.
- [ ] The editor's AI-context preview (the authored chip scene) reads the player's traits through the resolver, so a default Templates trait no longer counts as the player's. Ticket 03 left this unowned.
- [ ] Prompt changes follow the prompt-writing guide and ship with probe numbers against the cloud default, with in-batch controls.
- [ ] Context tests cover a cast entity's linked trait in full and summary context, and `{{char}}` on a cast entity, a world persona and Custom Persona.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
