# 28: Authoring Runs Place The Cast

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Test Code, the Test Bench script check, the sample Tool snapshot and the Tool lists run a script against a state built from the opening. That state has no entity placement. So in an authoring run:

- a Unique entity with a schedule reads as present at every Start place and every row place;
- `location` reads empty;
- a companion that follows from the start reads `following: false`;
- an entity that begins at Player's Starting Location is present nowhere.

In play each of these has one place, and the companion follows. An author who tests a script sees results the game never gives.

Give authoring runs a sample placement: the cast as the opening places it, at the opening hour. A Unique entity stands at its first Start, a Generic entity at all of its Starts, an entity at Player's Starting Location at the opening's location, and Follows the Player holds. The Test Bench AI context already places the cast this way; use that placement, do not write a second one.

The Scripts Reference says an authoring run gives an entity "every location it lists" and that "no entity has a position". Replace that with the rule above, and say that the sample uses the first Start where play rolls one.

For script tests on entities with a kind, reuse the fixture of ticket 27 when it has landed; otherwise use the position engine tests' fixtures. Do not add a third.

Do not rebuild the help vectors. Ticket 32 does that once.

Spec rulings: Q210, Q147, Q148, Q160.

## Acceptance criteria

- [ ] In Test Code, a Unique entity with a schedule reads one `location`, and only that location lists it in `present`.
- [ ] A companion with Follows the Player at Player's Starting Location reads `following: true` and the opening's location.
- [ ] A Generic entity is present at each of its Starts and nowhere else.
- [ ] The Test Bench script check, the sample Tool snapshot and the Tool lists read the same placement as Test Code. One test per caller, or one test at the shared builder plus proof that each caller uses it.
- [ ] The Test Bench AI context still gives the same cast as before this ticket.
- [ ] The Scripts Reference states the authoring-run rule and no longer says "no entity has a position".
- [ ] The landing lists every caller of the opening state and says which now carry the placement.
