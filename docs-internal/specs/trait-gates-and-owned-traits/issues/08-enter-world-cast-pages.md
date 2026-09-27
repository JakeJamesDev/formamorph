# 08: Enter-world cast pages

Status: ready-for-human
Status note: built in 34d012cf and its review follow-up; notes for later tickets under Comments.
Base: d740336b
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

## Comments

**Hand-over (2026-09-27).** Picks live in `EntryDraft.ownedTraitIds` (entity id → ids) with a visit-scoped `cascadeOffTraitIds`; `entryGateInput` / `withSettledTraits` / `entryDefaults` / `castOwnedTraits` in `src/lib/entryDraft.ts`. The save field is `GameState.ownedTraits` (additive), pruned on load by `withHeldOwners` in `src/lib/ownedTraitState.ts`.

- **Rulings applied (spec session):** ticket 11 loads library owners (08 wires `library: []`); Q1 = B, Enter World keeps a visit-scoped cascade-off list, so a pick a persona switch turned off returns on the switch back, world traits too; Q2 = keep, an entity's pages show group descriptions from its node down only.
- **Ticket 11:** pass the loaded library persona and added entities as `EntryTraitWorld.library` in MainMenu (in the order added) and re-key an added entity's picks to its copy id in `enterWorld`. The tree and the workspace already place them last.
- **Ticket 09:** the game starts with `ownedTraits[id].chosen` from the picks and no `disabled`; the runtime still settles the `world` owner only.
- **Not changed:** the legacy nested-save load paths (worker conversion, raw fallback) skip the prune, since those saves predate owned traits. The entity page repeats SetupTraitList's "Starting Traits" eyebrow. `PersonaPortrait` stays exported from PersonaPicker though it now draws any entity. The GameViewer seed line has no component test (no GameViewer harness); `ownedTraitStatesFrom` and the MainMenu start arguments are tested.
- **Live preview:** a seeded world on port 5215 showed Ash nested in Class with the user icon and "You", the 2:3 portrait page, "Unlocked by playing as Ash", and after a switch to Bob the banner "Turned off Royal Guard, because of Bob." with the row locked. Frames in dark and light; DOM reads for the rest.
