# 03: Enter World Offers A Persona's Start Locations

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

At Enter World, picking a persona adds its Start Locations to the world's flagged starting locations, and the first one is preselected. The player can still pick any other offered location.

- One function reads a persona's start places, and both the offered list and the preselect use it. This ticket owns it. A world persona reads its Starts (Playable) or its `locations` list (Persona-Only). Under None or a library persona, it reads the Custom Persona's list when the world has one.
- Today's behavior for a Playable persona is unchanged: Start places join the list, Player's Starting Location is left out, and the first flagged one is preselected.
- An empty list offers the world's flagged starting locations only.
- Update the help pages that describe the Starting Location step.
- Changelog fragment in `docs-internal/changelog.d/`.

Spec rulings: Q2, Q3.

## Acceptance criteria

- [ ] A persona pick test: picking a Persona-Only world persona lists the flagged starting locations plus its listed locations, in world order, and preselects its first listed location.
- [ ] Under None, a world with a Custom Persona lists its locations the same way and preselects the first.
- [ ] Under a library persona, the same Custom Persona list is offered and preselected.
- [ ] A location the player picked by hand stays picked after a persona change while it is still offered.
- [ ] A Playable persona's offered list and preselect are unchanged; the existing persona pick tests stay green.
- [ ] A persona with an empty list offers only the flagged starting locations.
