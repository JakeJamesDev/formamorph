# 07: Entity nodes in the tree: placement and drags

Status: ready-for-human
Base: 8c74e005
Blocked by: 06 — Owned traits in the editor
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: drag work under the shared drag layer's invariants (ADR-0007), where a wrong modifier or projection breaks nesting silently.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

An author organizes the one tree: entity nodes drag into world groups such as "Companions", and a trait drags between the world and an entity without losing its id or its requirements.

## Acceptance criteria

- [ ] An entity gains an optional tree placement: a parent world group and a sibling order. Absent means top level; a placement whose group is gone reads as top level. This is an additive world export change.
- [ ] An entity node drags like a group through the shared drag layer, into world groups only, never into another entity's node or owned group.
- [ ] A trait drag across owners changes the owner and keeps the id, so requirements pointing at it keep working.
- [ ] A cross-owner drag is refused with a note when the trait has stat changes or stat toggles.
- [ ] A group requirement counts traits of entity nodes placed inside the group.
- [ ] Trait tree tests cover entity nodes placed in world groups, the deleted-group fallback, the entity-in-entity refusal, and cross-owner drops that keep ids or are refused for stat effects.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.

## Comments

**Hand-over (2026-09-26).** Commit `adbf650c`. Placement is `Entity.traitPlacement?: { groupId, order }` (additive world export change). The drag rules live in `getOwnedTraitDropProjection` / `applyOwnedTraitDrop` in `src/lib/traitTree.ts`; real-mouse drags are in `e2e/trait-entity-nodes.spec.ts` (outside the four gates).

- **Refusal note for a group:** "Class stays a world group, because an entity's traits can't change stats. Remove the stat changes and stat toggles from Plate Armor first." The ruling quoted only the trait form; this group form awaits a look.
- **Entity-to-entity refusal:** the note names the owner the item stays with ("Gruff stays Bob's trait, …"). Only imported data can reach it, because owned traits have no Stats tab.
- **A world group holding an entity node** is kept among world items by the projection, the same way as the node itself.
- **Left on purpose:** a deleted group's `traitPlacement` stays on the entity and reads as top level, so undo puts the node back into the restored group.
- **Ticket 11:** entity exports carry `traitPlacement` like `groupId`. A foreign group id reads as top level, so it is harmless, but import could clear it.
- **Term split, not changed:** the trait panel says **Stat Availability**; the note and the Test Bench say "stat toggles".
