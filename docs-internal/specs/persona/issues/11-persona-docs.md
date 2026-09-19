# 11: Persona Docs

Status: ready-for-agent
Blocked by: 05, 07, 08, 10
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

**Parent:** [Persona](../spec.md)

**What to build:** The wiki explains personas to players and to authors, and the domain glossary gains the Persona term.

**Rationale for the model:** documentation is written by a strong model, never a smaller one. Medium effort fits.

## Acceptance criteria

- [ ] A player page covers: making a persona, the global default, the pick at Enter World, the change in game, and the SillyTavern import with where ST keeps its avatar files.
- [ ] An author page covers: marking an entity as playable, the world player setting, the Persona chip and its variants for prompt overrides, and the Player Name chip.
- [ ] The Openings author docs exist. Extend them where the Player Name chip and the played entity's openings change what they say, and link the pages both ways. Do not restate them.
- [ ] The author page states that text which names "the player" as a separate person reads wrong for a played entity, and that the author owns that text.
- [ ] The author page states the hard cutover: a world prompt override gets no persona until its author adds the chip.
- [ ] The domain glossary gains Persona, with "player character" and "user" as terms to avoid.
- [ ] The pages use short sections and tables, pin no version, and name no agent files.
- [ ] Every control name in the docs matches its label in the app.
- [ ] Lint and build pass. Add no changelog entry for docs alone.

## Scope notes

The wiki publishes on merge. Do not touch the wiki interface.
