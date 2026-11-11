# 08: Persona Starts Read Start Places

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

When a player enters a world as one of its entities, the places they can begin come from that entity's Start places. Today the readers use the stored list, which for an entity with a kind holds every Schedule row place and leaves out Player's Starting Location.

Readers that move: the persona's start location, the offered start locations in the Enter World flow, the same offer in the Test Bench lens and opening, and the "starts met" check for the played persona.

Corrections that land here (Q9):

- **Start offers (#7).** A played entity with a routine is offered its Schedule row places as places to begin. It is offered only the places of its Starts. A Start at Player's Starting Location offers the world's starting locations, or every location when none is flagged.
- **"Starts met" (#8).** The check counts row places as starts for the played persona. It counts Start places only.

The Custom Persona has no kind. Its stored locations keep working as today, read through the module.

Add the readers to the agreement test. The Enter World wiki text changes if it says where a played entity can begin.

Spec rulings: Q2, Q9 (#7, #8).

## Acceptance criteria

- [ ] A played Unique entity with one Start at a town and a row that sends it to a forest is offered the town only. The test fails with the old read.
- [ ] A played entity whose Start is Player's Starting Location is offered each flagged starting location, and every location when none is flagged.
- [ ] A played Generic entity is offered the place of each of its Starts.
- [ ] The "starts met" check for a played persona is true at a Start place and false at a place only a row names. The test fails with the old read.
- [ ] The Custom Persona is offered the same places as before. A test covers it.
- [ ] The Enter World flow and the Test Bench lens offer the same places for the same world and persona. A test compares them.
- [ ] The agreement test holds the readers moved here.
- [ ] A changelog fragment records the two fixes.
