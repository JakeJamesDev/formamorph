# 06: Owned traits in the editor

Status: ready-for-human
Status note: built in 58160dc6 and ef96d217; notes for later tickets under Comments.
Base: 8c74e005
Blocked by: 02 — Requires field in the editor
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: a new data shape on entities and its first two editor surfaces, where the no-stat-effects rule and cross-owner requirements must hold together.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

Any entity can own traits and trait groups. An author adds the first one from the entity editor, and from then on the entity appears as a node in the Traits tab, where its traits are edited like world traits. Requirements can point across owners in both directions.

## Acceptance criteria

- [ ] An entity gains optional owned traits and owned trait groups that reuse the trait and group shapes. This is an additive world and entity export change.
- [ ] Owned traits carry no stat changes and no stat toggles, and hide the stat sections. They keep requirements and placeholder pins.
- [ ] The entity editor gains a Traits section that lists the entity's owned traits and adds new ones.
- [ ] An entity node appears at the top level of the Traits tab once its entity owns a trait, and disappears when it owns none. It shows a user icon in the folder icon's slot with "Entity" or "Playable" as meta.
- [ ] Under the node, owned traits and owned groups edit like world traits, including exclusive groups. An owned trait shows its owner at the top of Details and has no Stats tab.
- [ ] The Requires picker lists owned traits with their owner, and the gate module resolves requirements across owners both ways.
- [ ] Trait tree tests cover nodes shown and hidden by ownership; component tests cover the entity editor Traits section and the owner line.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.

## Comments

**Hand-over (2026-09-26).** Data: `Entity.traits` / `Entity.traitGroups`. Pure edits and the editor gate input are in `src/lib/ownedTraits.ts`; the one tree is `ownedTraitTree` / `applyOwnedTraitDrop` in `src/lib/traitTree.ts`.

- **Ticket 07 (placement and drags):** an entity node is a synthetic group whose id is the entity's, placed after every world root item in entity order. Owned root items point at it. `applyOwnedTraitDrop` refuses entity-node drags and cross-owner drops; lift those two guards and add the stat-effect refusal. Entity nodes are `fixed` rows today.
- **Rulings applied (spec session, Q1–Q9):** see the Editor section of the spec. The node shows for a trait or a group (Q8); a duplicated entity's "playing as" itself follows the copy (Q9).
- **Decided here:** owned traits get no code-rename offer, because code reaches world traits only. The entity-node panel adds a name header and **Open Entity**, matching the Placeholders tab's owner panel.
- **Tickets 08–09:** Enter World and play still build a world-only gate input, so a world trait that requires an owned trait reads locked there as "a missing trait" until they pass entity owners.
- **Not changed:** the Traits tab search lists world traits only. Entity-scoped placeholder chips inside owned-trait text are not re-aimed when an entity is duplicated (`remapEntityChips` covers the entity's own fields only). Owned-trait pins join the pin-conflict note in ticket 09.
