# 05: Gates per bearer

Status: ready-for-human
Base: a1b44ca4
Blocked by: 01 — Link data and bearer resolution
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

Rationale: changes the meaning of every requirement in the gate module and threads the bearer through settle, gate states, the Requires picker and both callers. Correctness work with cascade edge cases.

Parent: [Trait Links spec](../spec.md)

## What to build

"Smite requires Paladin" means Paladin on the same bearer. An author can name a bearer instead: You or an entity that bears the trait. The gate module settles per bearer, and enter-world and play settle every bearer through the bearer-resolution module.

## Acceptance criteria

- [ ] `settle` and `gateStates` run per bearer from the resolver's gate input. A requirement without a scope holds when its target is active in the same bearer's set. A named requirement holds when the target is active in the named bearer's set. You means the played persona's set, which under None or a library persona includes Custom Persona's links.
- [ ] A scopeless requirement never holds through another bearer. No compat rule for old cross-owner requirements.
- [ ] The Requires picker's Add Requirement rows gain a bearer choice: same bearer by default, or a named bearer from a list of You plus every entity that bears the target. A chip reads "Albus: Paladin" or "You: Paladin".
- [ ] Enter-world and in-play settle, cascade banners, return and the cascade-off list all work per bearer, with the existing wording.
- [ ] Never-unlockable analysis runs per bearer.
- [ ] Gate tests cover: a same-bearer requirement that fails through another bearer, a named requirement on a cast entity and on You, a persona switch that changes You, and never-unlockable per bearer. Component tests cover the bearer choice in the picker.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
