# 08: Bearers at enter-world and in play

Status: ready-for-agent
Blocked by: 05 — Gates per bearer; 06 — Pins per bearer; 07 — Persona-only entities
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

Rationale: the save shape, the trait runtime's stat path on a persona switch, and two player surfaces meet here. The riskiest ticket for silent state drift.

Parent: [Trait Links spec](../spec.md)

## What to build

A player sees each entity's bearer tree at enter-world and in the Traits tab, links and owned traits together in author order. The picked persona's tree is theirs, marked "You". NPC link defaults follow the owned-trait rules. A persona switch in play applies the new persona's linked stat traits and reverses the old one's. The save keys active state by bearer.

## Acceptance criteria

- [ ] Entity pages at enter-world and the in-game Traits tab show the bearer tree from the resolver, links and owned traits together in author order, with "You" on the played bearer. Custom Persona shows as the player's section under None or a library persona.
- [ ] The player changes an NPC's link defaults under the existing owned-trait rules. Toggling in play follows the original's Player Can Toggle for every bearer.
- [ ] A linked trait's stat effects apply when the player bears it and do nothing on an NPC. A persona switch in play applies the new persona's active linked stat traits and reverses the old one's through the honest reversal path, with the existing log lines.
- [ ] Active state is keyed by bearer and holds original ids. The Custom Persona bearer uses the player's world key, so None and library personas share it; those picks survive a switch between them at enter-world. The cascade-off list follows the same keys. Load prunes bearers the playthrough no longer holds. Additive save change.
- [ ] Save round-trip tests cover per-bearer state, Custom Persona state shared by None and a library persona, and pruning of a removed bearer. Runtime tests cover the persona switch applying and reversing linked stats. Component tests cover the entity page and the Traits tab sections.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
