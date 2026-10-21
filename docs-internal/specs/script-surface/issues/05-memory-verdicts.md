# 05: Memory Verdicts

Status: ready-for-agent
Blocked by: 03, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: new write kinds cross the executor, the merge, the turn commit and the World Tool landing, and each must reach the save field the panel already writes.

## What to build

A memory entry takes `pin()`, `forget()`, `edit(text)` and `remove()` (Q3). They collect into the run's world writes beside location and diary writes, merge in order across the scripts of one timing, and land at commit on the save's existing fields: verdicts on the pins record, edits on the overrides with the original kept, removals on the deleted set (spec: Implementation Decisions). On a Custom line, `pin()` and `forget()` do nothing and list as dropped writes in the run output, as a read-only write lists; `edit` and `remove` work on one (Q15). Writes never read back within the run (Q9) and persist through a rewind as a player's do (Q18). A World Tool script's verdicts land when the tool call commits, beside its stat and trait writes (Q23). The switch landing from ticket 04 carries the new kinds. The Memory panel shows a script's verdict, edit and removal as it shows the player's. The memories list the runs read moves into the Sandbox Snapshot, captured once per turn, in place of the last-render list ticket 03 landed with (Q40).

Spec: Q3, Q9, Q15, Q18, Q23, stories 9, 10, 19.

## Acceptance criteria

- [ ] After a turn whose script calls `memories[0].forget()`, `memories[1].pin()`, `memories[2].edit("...")` and `memories[3].remove()`, the panel shows a drop verdict, a keep verdict, an edited row with its original and a deleted row; a test asserts the four save fields
- [ ] `pin()` on a Custom line changes nothing and the run output lists it as a dropped write; the Test Bench and Test Code show the same line
- [ ] Two scripts in one timing writing opposite verdicts on one row: the later script's verdict stands
- [ ] A World Tool script's `forget()` lands when its call commits; a user Tool has no such verb
- [ ] A rewind past the writing turn leaves the verdicts and the edit in place
- [ ] The Before and After runs of one turn read one memories capture from the Sandbox Snapshot; a test pins a row through the panel between the two runs and the After run still reads the capture
- [ ] Four gates green

## Blocked by

- 03 (Memories Reads)
- 04 (Trait Switch Landing)
