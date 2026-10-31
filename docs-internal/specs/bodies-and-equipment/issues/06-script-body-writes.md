# 06: Script Body Writes

Status: done
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Scripts read and write an owner's Body by name. The owner surface gains `body`. Reading it gives the Body in force's name, with each slot's capacity and the Item Copies in it. Assigning a Body name sets the owner's base Body, which the save stores. An active trait's Body still wins over the base (Q14). An unknown name fails the write. The resolver gains the base Body between trait overrides and the authored pick, and a base change goes through the settle from 05.

A script that runs between turns settles at once (Q56). This covers a switch script and an item script. The switch-run landing (`landSwitch` in `GameViewer.tsx`) and the item-script landing run the same settle a Traits tab toggle runs. A trait's Body change, a `body` write and a requirement failure all unequip, fire When Unequipped and write the log line then, not at the next turn.

A Test Bench rule reports a script that names a Body that doesn't exist. The Variable menu and hover cards list `body`.

Spec: Implementation Decisions under Body in force and Scripts; Q14, Q20, Q25 (soft reference half), Q56.

## Acceptance criteria

- [x] `body` reads the Body in force with its slots, capacities and contents (`statCodeExecutor.body.test.ts`, reads the Body in force)
- [x] Writing a Body name sets the base Body. An active trait's Body still wins, and the base returns when the trait ends (`settle.bodies.test.ts`, a script-written base Body; `statCodeExecutor.body.test.ts`, keeps the trait Body in the read)
- [x] The base Body is saved and survives a load (`bodies.base` in the save: `GameViewer.bodyWrites.test.tsx`; settle round trip in `settle.bodies.test.ts`. The load line `setBodies(gameState.bodies)` is read, not driven)
- [x] A between-turn switch or item script that changes a Body, or fails a requirement, unequips at once, fires When Unequipped and writes the log line (`GameViewer.bodyWrites.test.tsx`: switch script, and an item script started from the panel. A requirement failure has no test of its own on these landings)
- [x] A write of an unknown name fails the script with an error (`statCodeExecutor.body.test.ts` and `GameViewer.bodyWrites.test.tsx`)
- [x] The Test Bench rule fires on an unknown Body name and stays quiet on a real one (`rules.test.ts`, a script assigning a Body name)
- [x] The Variable menu and hover cards list `body`. The Scripts Guide documents it (surface tests: `statCodeVariableTree.test.ts`, `src/lib/docs`; the docs page is `docs/Scripts-Reference.md`, section Bodies)
- [x] ⚠️ The response that lands this ticket reminds the user of the save shape change (spec session landing report, 2026-10-31) (in the landing report)

## Landed

**Not verified**
- A requirement failure on the switch-run and item-script landings has no test of its own. The landings run the same settle that handles it.
- The load path (`setBodies(gameState.bodies)`) is read, not driven by a save-and-load test.
- A later script in the same run batch reads the base Body from the batch start. A write lands for the next batch.

**Known gap (Q57–Q60)**
- A script cannot clear the base Body back to the authored pick. It assigns that Body's name.

**Noted**
- A Body write in a turn timing (before, after, output) settles at once, as inventory writes in those timings do. The turn commit does not settle it a second time.

**For you**
- Play a world where a switch script runs `persona.body = "<Body>"` with an item equipped in a slot the Body lacks: the item comes off at once, the log reads "Body: …. Unequipped …", and the Inventory panel shows the new slots.
