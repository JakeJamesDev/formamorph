# 01: Unpicked Personas Stay Off The Map And Out Of Known In

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

A Persona-Only entity that the player did not pick never holds a Position and never appears through Known In. Today the positioned cast keeps it, so its routine gives it a Position, and the Known In lookup can list it. It is never in the cast (`inCast`), so neither should happen.

- Reproduce first: a world with a Persona-Only entity placed at the player's starting location and a Known In pick there, played under another persona. Read the turn's request body and the map positions on today's code, and record what leaks.
- The positioned cast drops an entity with the Persona and Persona-Only marks unless it is the played persona, as it already drops the Custom Persona.
- The Known In lookup drops the same entities.
- The played Persona-Only entity is unchanged: it is the player.
- Changelog fragment in `docs-internal/changelog.d/` only if the leak reached anything a player sees.

Spec rulings: Q6.

## Acceptance criteria

- [ ] A game turn test, red on today's code, shows that an unpicked Persona-Only entity at the player's location with a Known In pick there is absent from the turn's request body.
- [ ] The same setup leaves the entity without a Position: the map roster and the present-entity list never name it.
- [ ] The guard bites: reinstating the old positioned cast or Known In lookup turns the test red.
- [ ] Played as that Persona-Only entity, the player still starts and moves as before; an existing persona play test stays green.
- [ ] The ticket records what the reproduction found leaking on today's code.
