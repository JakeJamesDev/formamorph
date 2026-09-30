# 01: Links only from Blueprints

Status: ready-for-human
Base: a23713a0

Parent: [Blueprint-Only Links spec](../spec.md)

## What to build

Only a Blueprints item becomes a link's original (Q1). A root item dragged onto an entity moves in as owned, in Advanced as in Basic (Q2). A drag out of Blueprints is refused while any entity links the item or something in it (Q7).

## Acceptance criteria

- [ ] `applyOwnedTraitDrop` links only a Blueprints row. A root row takes the move path, with the stats refusal as today.
- [ ] A root group dropped on the Custom Persona entity moves in. The `offered` refusal and its copy are gone.
- [ ] **Link To…** shows only on Blueprints items. `addLink` returns null for a non-Blueprints original.
- [ ] A drag that takes a linked item out of the Blueprints subtree is refused with a notice that names the linking entities.
- [ ] Test Bench `trait-link-redundant` drops its `offered` reason.
- [ ] Tests for each rule, each shown to bite. The changelog line is in In Progress.
