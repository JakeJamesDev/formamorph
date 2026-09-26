# 06: Owned traits in the editor

Status: ready-for-agent
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
