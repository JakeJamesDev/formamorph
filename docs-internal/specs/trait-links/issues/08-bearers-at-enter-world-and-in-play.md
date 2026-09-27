# 08: Bearers at enter-world and in play

Status: ready-for-human
Base: d5787517
Blocked by: 05 — Gates per bearer; 06 — Pins per bearer; 07 — Persona-only entities
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

Rationale: the save shape, the trait runtime's stat path on a persona switch, and two player surfaces meet here. The riskiest ticket for silent state drift.

Parent: [Trait Links spec](../spec.md)

## What to build

A player sees each entity's bearer tree at enter-world and in the Traits tab, links and owned traits together in author order. The picked persona's tree is theirs, marked "You". Cast entities' link defaults follow the owned-trait rules. A persona switch in play applies the new persona's linked stat traits and reverses the old one's. The save keys active state by bearer.

## Acceptance criteria

- [x] Entity pages at enter-world and the in-game Traits tab show the bearer tree from the resolver, links and owned traits together in author order, with "You" on the played bearer. Custom Persona shows as the player's section under None or a library persona.
- [x] The player changes a cast entity's link defaults under the existing owned-trait rules. Toggling in play follows the original's Player Can Toggle for every bearer.
- [x] A linked trait's stat effects apply when the player bears it and do nothing on a cast entity. A persona switch in play applies the new persona's active linked stat traits and reverses the old one's through the honest reversal path, with the existing log lines.
- [x] Active state is keyed by bearer and holds original ids. The Custom Persona bearer uses the player's world key, so None and library personas share it; those picks survive a switch between them at enter-world. The cascade-off list follows the same keys. Load prunes bearers the playthrough no longer holds. Additive save change.
- [x] Save round-trip tests cover per-bearer state, Custom Persona state shared by None and a library persona, and pruning of a removed bearer. Runtime tests cover the persona switch applying and reversing linked stats. Component tests cover the entity page and the Traits tab sections.
- [x] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [x] State every export-shape change in the response.
- [x] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.

## Comments

**From ticket 08 (2026-09-27).** A Custom Persona pick stays chosen under a world persona and lies dormant: it lays no pin, moves no stat, opens no gate and has no row until a return to None or a library persona. `heldPlayerTraits` in the trait runtime is the seam. Left open: `{{char}}` in a Custom Persona trait's card under None reads as no name (Q56 is ticket 09's); the Traits tab seeds its open sections on the first render of a new game, before the seed commit lands, so a world with stats opens with every section folded (present before this ticket); `ownedTraitTree` without `links` has no production caller now that play reads `bearerTraitTree`.
