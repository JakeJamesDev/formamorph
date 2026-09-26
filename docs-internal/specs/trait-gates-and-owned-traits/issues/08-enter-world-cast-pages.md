# 08: Enter-world cast pages

Status: ready-for-agent
Blocked by: 03 — Gates in play, 07 — Entity nodes in the tree: placement and drags
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the enter-world workspace, the save envelope, and persona switching meet here; per-owner state and the "You" mark must survive every switch.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

At enter-world the player shapes the cast. Every entity with owned traits has a page with its portrait, the player picks its traits, the played entity is marked "You" where the author placed it, and the picks survive persona switches, save, and load.

## Acceptance criteria

- [ ] The enter-world tree shows entity nodes from the one tree module: world nodes by placement, library nodes (persona or added character) last at top level in the order added. Nav rows show the user icon.
- [ ] An entity's page shows its portrait in the Persona picker's 2:3 frame beside its name and player description, and its owned traits with the same locked rows, banner, and cascade as world traits.
- [ ] Owned defaults preselect per entity, so a player can leave the cast as authored.
- [ ] The played entity stays in its authored place, marked "You". Its picks are kept when the player switches persona and back.
- [ ] A persona change re-checks playing-as requirements through `settle`.
- [ ] The save stores owned trait state per owner: chosen ids and ids switched off in play, beside the cascade-off list. This is an additive save export change. Load drops the state of an entity id the world no longer holds.
- [ ] Save round-trip tests cover per-owner state, picks kept across a persona switch, and state dropped for a removed entity. Component tests cover the entity page and the "You" mark.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
