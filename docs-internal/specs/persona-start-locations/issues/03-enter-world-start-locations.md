# 03: Enter World Offers A Persona's Start Locations

Status: done
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

- [x] A persona pick test: picking a Persona-Only world persona lists the flagged starting locations plus its listed locations, in world order, and preselects its first listed location that is a flagged starting location, else its first (spec session ruling Q11). `personaPick.test.ts`: "lists a Persona-Only world persona's flagged and listed locations…".
- [x] Under None, a world with a Custom Persona lists its locations the same way and preselects the first. `personaPick.test.ts`: "offers the Custom Persona's list under None and under a library persona…".
- [x] Under a library persona, the same Custom Persona list is offered and preselected. Same test.
- [x] A location the player picked by hand stays picked after a persona change while it is still offered. `personaPick.test.ts`: two hand-pick tests.
- [x] A Playable persona's offered list and preselect are unchanged; the existing persona pick tests stay green. Affected-test gate green.
- [x] A persona with an empty list offers only the flagged starting locations. `personaPick.test.ts`: "offers only the flagged locations… with an empty list".
- [x] Test Bench opening and lens follow (Q12). `opening.test.ts` bites: reverting `opening.ts` fails it.

## Landed

**Not verified**
- The Enter World screen itself (list, preselect, **Starts at** line on the Custom Persona row) was read through unit tests only, not in a browser.
- The Test Bench fresh seed (`seedLens`) still opens on the seeded location and ignores a persona's start. A world persona had the same gap before; left alone.

**For you**
- Enter World, world with a Custom Persona that has Start Locations: pick None, then a library persona. Check the list gains those places and the first flagged one is selected.
- Quick Start now also lands on that Custom Persona start when None or a library persona is the preselect (same shared function; no ticket line asked for it).
