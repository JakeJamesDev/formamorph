# 04: Persona and Tied Trait Slots

Status: ready-for-human
Base: 32612c5e
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Parent: [Breadcrumb Picker spec](../spec.md)

## What to build

The two entity-scoped trait slots show which entity holds each trait, and where (Q2–Q4).

- `trait(persona)`: each persona-capable entity's traits, in that entity's own tree order. The breadcrumb leads with the entity's code name, then its own groups. A name that two persona entities share shows under each holder. Both rows pick the same value, because `persona.traits` reads by name (Q3).
- `trait(entity)`: the picked entity's traits, owned and linked, with a breadcrumb from that entity's own groups.
- Extend the editor-side entity name builder so each trait carries its group path. The code completions keep working from the same source.

## Acceptance criteria

- [x] The Code Templates dialog test uses two persona entities that share a trait name. It finds the name under both, and either row generates the same code.
- [x] `trait(entity)` shows the picked entity's group breadcrumbs, and changes when the entity changes.
- [x] Code completions and checks for `persona.traits` and `entities[...].traits` still pass their tests.
- [x] The four gates are green.

## Notes from ticket 03

- The world-trait source is `worldTraitPlaces`, which returns `CodeTraitPlace { id, name, path }`. Reuse that shape for entity traits.
- `CodeEntityNames` now carries optional `folder` and `tabPosition`, set by `entityTraitNames` in authored order.
- `WORLD_BREADCRUMB` is exported from the trait gates module.
