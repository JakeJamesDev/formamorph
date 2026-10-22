# 05: Memory Verdicts

Status: done
Blocked by: 03, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: new write kinds cross the executor, the merge, the turn commit and the World Tool landing, and each must reach the save field the panel already writes.

## What to build

A memory entry takes `pin()`, `forget()`, `edit(text)` and `remove()` (Q3). They collect into the run's world writes beside location and diary writes, merge in order across the scripts of one timing, and land at commit on the save's existing fields: verdicts on the pins record, edits on the overrides with the original kept, removals on the deleted set (spec: Implementation Decisions). On a Custom line, `pin()` and `forget()` do nothing and list as dropped writes in the run output, as a read-only write lists; `edit` and `remove` work on one (Q15). Writes never read back within the run (Q9) and persist through a rewind as a player's do (Q18). A World Tool script's verdicts land when the tool call commits, beside its stat and trait writes (Q23). The switch landing from ticket 04 carries the new kinds. The Memory panel shows a script's verdict, edit and removal as it shows the player's. The memories list the runs read moves into the Sandbox Snapshot, captured once per turn, in place of the last-render list ticket 03 landed with (Q40).

Spec: Q3, Q9, Q15, Q18, Q23, stories 9, 10, 19.

## Acceptance criteria

- [x] After a turn whose script calls `memories[0].forget()`, `memories[1].pin()`, `memories[2].edit("...")` and `memories[3].remove()`, the panel shows a drop verdict, a keep verdict, an edited row with its original and a deleted row; a test asserts the four save fields. `GameViewer.memoryVerdicts.test.tsx` › lands forget, pin, edit and remove (pins, edits, deleted, notes; the Memory Manager shows the edit, "Originally: s3", no s4, three Clear Pin rows); commit landing removed → 4 tests red
- [ ] `pin()` on a Custom line changes nothing and the run output lists it as a dropped write; the Test Bench and Test Code show the same line. Play half: `statCodeExecutor.memoryVerbs.test.ts` › drops pin and forget on a Custom line (`readOnlyWrites`), `GameViewer.memoryVerdicts.test.tsx` › drops a pin on a Custom line; Custom check removed → both red
- [x] Two scripts in one timing writing opposite verdicts on one row: the later script's verdict stands. `statCodeTurn.worldWrites.test.ts` › joins two scripts' opposite verdicts; `memoryWrites.test.ts` › applies in call order; merge reversed → red
- [ ] A World Tool script's `forget()` lands when its call commits; a user Tool has no such verb. World Tool half: `GameViewer.memoryVerdicts.test.tsx` › lands a call / after World Tool's forget when its turn commits (Q45)
- [x] A rewind past the writing turn leaves the verdicts and the edit in place. `GameViewer.memoryVerdicts.test.tsx` › keeps the verdict and the edit after a rewind, through Rewind to Here; a rewind that clears pins → red
- [x] The Before and After runs of one turn read one memories capture from the Sandbox Snapshot; a test pins a row through the panel between the two runs and the After run still reads the capture. `GameViewer.memoryVerdicts.test.tsx` › runs the Before and After scripts over one capture, the verdict set by the Memory Manager's button mid-turn; capture removed → 1, not 11
- [x] Four gates green. Review gates: typecheck and changed-file lint PASS; prepare runs the full list before it lands

## Blocked by

- 03 (Memories Reads)
- 04 (Trait Switch Landing)

## Landed

**Not verified**

- Criterion 2, editor half: Test Code and the Test Bench run with `memories` empty (Q12), so no Custom line exists there. The dropped write joins `readOnlyWrites`, which both surfaces format through one path ("Read-only fields. Writes ignored: memories[2].pin().") (Q45).
- Criterion 4, user Tool half: a user Tool has no `memories` today, so the verb is absent by construction. Ticket 08 builds the read-only user Tool surface, which drops every function member, and owns that test.

**For you**

- Ticket 07: the four verbs `pin`, `forget`, `edit`, `remove` sit at the end of `MEMORY_ENTRY_FIELDS` in `src/lib/statCodeSurface.ts`, as function-detail entries with no `access` (Q41 as amended, Q45).
- Ticket 10: the guide's Quick Reference row lists the verbs; the Memory section's prose does not cover them yet.
- The capture is a per-turn ref in GameViewer that feeds `SandboxState.memories`, the way the turn's location and clock are captured; `snapshotOf` is unchanged.
- A switch run's verdict or edit lands even before the first turn, so a script can edit a Custom line the player wrote at the start.
- In a game, add a world script `memories[0].forget();` at After the AI, play a turn, and open **Manage Memories**: the oldest row shows **Pin This Memory** and **Clear Pin**.
