# 06: World Personas

Status: ready-for-agent
Blocked by: 03, 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Persona](../spec.md)

**What to build:** An author marks world entities as playable, and the player can play as one. The picker lists the world's own personas under their own heading, apart from library personas. The played entity leaves the cast for that playthrough and returns when the player switches away. The Persona chip tells the AI that the other entities of this world know this person. Picking a world persona preselects the starting location.

**Rationale for the model:** the ticket joins the picker, the cast filter, and new prompt text with its own probe run. A strong model at high effort.

## Acceptance criteria

- [ ] Only world entities that carry the mark appear in the picker. The reference stores the world source.
- [ ] The played entity is absent from the roster at every one of its locations, and from every other reader, through the module from ticket 02. An AI-context test proves it.
- [ ] A switch away from a world persona returns that entity to the cast on the next turn.
- [ ] The Persona chip adds the known-person line for a world persona only. A library persona gets no such line. Builder tests cover both.
- [ ] The known-person line follows the prompt writing guide and ships with probe numbers on both reference tiers, recorded in the ticket's comments.
- [ ] Relationships that point at the played entity render as ties to the player.
- [ ] When one of the entity's locations is a starting location, the step preselects the first such location. The player can change it. Tests cover an entity with no starting location among its locations.
- [ ] The opening pool reads the module's cast, so a played entity's openings leave the pool. When the Openings work is not yet built, record this in a comment on the Openings spec and skip the code.
- [ ] A world persona's own placeholders resolve as they do today. A test proves it.
- [ ] The picker with both headings is checked in the preview through the dev-router.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

The author owns entity text that names "the player" as a separate person. This ticket does not rewrite it; ticket 11 documents it. No new export-shape change: the mark shipped in ticket 01.
