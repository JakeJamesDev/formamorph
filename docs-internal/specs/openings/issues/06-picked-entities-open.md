# 06: Picked Entities Open The World

Status: in-progress
Base: c0ba2b9f
Blocked by: 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

**Parent:** [Openings](../spec.md)

**What to build:** A player who picks library entities at Enter World gets an opening from those entities. If any picked entity has a drawable opening, the draw uses only the picked entities' rows, pooled together by weight. If none has one, the world's pool applies. The world's switch is an author's draft control and does not cancel the player's pick. After a reload, page-one regenerate still draws from the correct pool.

**Rationale for the model:** a contained rule in the pure module plus the threading from Enter World into the game start. Opus at medium effort, because the loaded-save case is easy to miss.

## Acceptance criteria

- [x] The Openings module takes the picked entities and gives them priority over the world pool. Weight 0 rows do not count as drawable.
- [x] Several picked entities pool their rows together by weight.
- [x] A picked entity with no drawable opening leaves the world's pool in effect.
- [x] The world switch set to off does not remove picked entities' rows.
- [x] Gameplay writes nothing to the authored world. The picked entities stay runtime entities.
- [x] On a loaded save, the pool for page-one regenerate is rebuilt from the world plus the entities seeded at the initial turn.
- [x] Module tests cover priority, pooling, the fallback, and the switch. A game-start test covers the loaded-save rebuild. One guard is proven by reinstating its fault.
- [x] A live start with a picked entity is checked in the preview through the dev-router, with static DOM evidence.
- [x] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

No data change and no export-shape change. If ticket 03 is not yet done, a picked entity can carry only Opening Actions, and this ticket still holds.
