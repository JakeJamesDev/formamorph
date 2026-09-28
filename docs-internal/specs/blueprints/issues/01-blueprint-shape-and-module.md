# 01: Blueprint shape and module

Status: ready-for-human
Base: 6fd4d4db
Blocked by: None (can start immediately)
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high
Rationale: the main seam. One generic shape and one pure module that every later ticket and a future stats effort read through. The rules must be right the first time.

Parent: [Blueprints spec](../spec.md)

## What to build

The world can express "this link or copy reads its blueprint live until edited." A test builds a small world with a blueprint trait, a link with one override, a blueprint placeholder and a copy, and reads back the effective record each bearer sees, which fields are overridden, which overrides are stale, and which placeholder a bearer reads for a blueprint id. Nothing renders yet.

- One shape for every blueprint-origin record: a `blueprintId` and a sparse override map. Each override stores the blueprint value it was made against.
- Trait links carry overrides for default-on, requirements, pins, Player Can Toggle and stat changes, keyed by original trait id. The per-link `defaults` and name-keyed pin values are replaced, not kept beside.
- A copy is an entity-owned placeholder with `blueprintId`. Overrides per value id: text, weight, removal. Own values beside. Blueprint values added later appear in every copy. Value ids are the blueprint's.
- `bearerPlaceholder` leaves the pin shape. A trait pin names a blueprint placeholder by id.
- The module gives the effective record with its overridden and stale field lists, and the copy lookup: the bearer's own copy, then for a library persona the Custom Persona entity's copy, then the blueprint.
- The Custom Persona system node leaves the world type; an entity gains the mark. The bearer-resolution module reads the mark. UI for the mark is ticket 02.

## Acceptance criteria

- [ ] Table-driven tests on the module cover: untouched link reads live; one override; reset one field; reset all; stale detection against the snapshot; copy with a reworded value, a weight override, a removed value, a new own value and a blueprint value added later.
- [ ] Copy lookup tests cover a world persona, a library persona with and without its own copy, the Custom Persona entity, and None with no marked entity.
- [ ] Every existing trait-links test that read `defaults`, `pinValues` or `bearerPlaceholder` reads the new shape and passes.
- [ ] Each guard is proven to fail with its rule removed.
- [ ] The response names every export-shape change: world shapes for links, copies, pins and the Custom Persona mark.
