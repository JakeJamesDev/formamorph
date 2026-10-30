# 07: Planner Casts Strangers by Stranger Name

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The turn planner casts an entity that has a Stranger Name under that name as its alias until the player meets it. Prose and panels then agree from the first turn, and the true name does not slip early. The narrator keeps receiving aliases through the planner.

## Acceptance criteria

- [x] The planner prompt names an unmet entity that has a Stranger Name by that name as its alias. Roster field in `chipValues.test.ts` ("the planner's stranger override"), planner-only layering in `turnPasses.test.ts`, labels in `presence.test.ts`; cloud LABEL 100% (30/30).
- [x] A probe on cloud with in-batch controls, old prompt against new with at least 5 runs per arm, reports how often the true name leaks and how often the alias matches the Stranger Name. The numbers go in the landing message. `stranger-alias-probe.mjs`, 10 runs per case per arm, three arms in one batch.
- [x] Met entities, and entities without a Stranger Name, are cast as today. Every other roster is byte-equal (`chipValues.test.ts`), the reveal lookup ignores them (`presence.test.ts`), and the cloud control holds at 97% against 83% for the old prompt.

## Landed

**Not verified**

- The GameViewer wiring (the met-at-start check, the planner tokens on the precall turn, the backstop's reveal and label inputs) runs inline in the turn handler. No unit test reaches it; typecheck and the probe's use of the same helpers cover it.

**For you**

- Play Emberwatch with a stranger authored, and read whether the narration keeps the stranger's name hidden until they are introduced.
- On the precall planner, open Request Anatomy for a turn with an unmet stranger and read the `stranger name` line in the Entities block.
