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
- [ ] Both editors show the mark and the pronouns field on the Profile tab, through the shared entity fields body and the shared entity tab list, so the two editors cannot drift.
- [ ] Pronouns joins the field-to-tab map, and the World Editor find bar opens the Profile tab on a pronouns hit. The tab tests cover it.
- [ ] In the World Editor the mark is an Advanced control, and an entity that carries it counts as Advanced data for the notice beside the mode switch. Pronouns shows in both modes. The library editor shows both.
- [ ] The Entities tab filter shows all entities or only personas. The filter choice is device-local.
- [ ] The entity context builder renders pronouns in the Simple, Markdown, and XML formats. An entity with no pronouns renders exactly as it does today. Builder tests cover each format.
- [ ] An exported entity card and a published listing carry both fields. An import keeps them. Round-trip tests prove it.
- [ ] A world export carries both fields on its entities. A world with neither field loads unchanged.
- [ ] Help copy for the two controls follows the UI help copy pattern and uses "entity", never "character".
- [ ] The response states the export-shape change: two additive entity fields, in worlds, cards, and listings.
- [ ] Both editors are checked in the preview through the dev-router, with static DOM evidence.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

The Openings work is built. It gave both entity editors one shared tab list with a field-to-tab map, and this ticket builds on that list. This ticket adds no picker and no gameplay use of the mark.
