# 01: Persona Mark and Pronouns

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Persona](../spec.md)

**What to build:** An entity gains a Persona mark and a pronouns field. Both entity editors, in the World Editor and in the library, show the two controls. The Entities library tab gets a filter that shows only marked entities. Pronouns render in the entity context that the AI reads, for every entity. Setting the mark on an entity the player already has is the whole of "convert entity to persona". No copy is made.

**Rationale for the model:** the work follows the existing entity field, editor, and card patterns. A mid-tier model at medium effort fits.

## Acceptance criteria

- [ ] The Persona mark is an optional boolean on the entity. Pronouns is optional free text on the entity.
- [ ] Both editors show the mark and the pronouns field through the shared entity fields body, so the two editors cannot drift.
- [ ] The Entities tab filter shows all entities or only personas. The filter choice is device-local.
- [ ] The entity context builder renders pronouns in the Simple, Markdown, and XML formats. An entity with no pronouns renders exactly as it does today. Builder tests cover each format.
- [ ] An exported entity card and a published listing carry both fields. An import keeps them. Round-trip tests prove it.
- [ ] A world export carries both fields on its entities. A world with neither field loads unchanged.
- [ ] Help copy for the two controls follows the UI help copy pattern and uses "entity", never "character".
- [ ] The response states the export-shape change: two additive entity fields, in worlds, cards, and listings.
- [ ] Both editors are checked in the preview through the dev-router, with static DOM evidence.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

Openings ticket 01 adds tabs to the same entity editor. Check for a running session on it before the first edit, and sequence the editor work. This ticket adds no picker and no gameplay use of the mark.
