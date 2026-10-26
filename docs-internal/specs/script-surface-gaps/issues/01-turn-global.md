# 01: Turn Global

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the action and number must reach the snapshot on every run path, each with its own off-by-one, and the ticket owns the rename of the executor's internal per-stat turn readings.

## What to build

A script reads `turn.action` and `turn.number` (spec: Surface, Q2). `turn.action` is the player's text as sent, trimmed, with OOC brackets kept and no images (Q5). On the opening turn and At Game Start it reads the cue the narrator gets: the player's edited cue, else the drawn opening, never the "START GAME" stand-in (Q6). An Opening Narration start reads empty (Q22). `turn.number` uses the `memories[].turn` scale: finished turns plus one while a turn is in progress, the finished turns between turns, 0 before turn 1 (Q8, Q25). A When a Trait Switches run inside a turn reads that turn's values (Q24); one between turns, and the Background Pass Queue, Formaquestion Tools and user Tool calls, read the last finished turn with an empty action (Q7, Q35). World Tool and user Tool scripts read `turn`; user Tools stay read-only. Test Code and the Test Bench read a sample action at number 2, and At Game Start reads the world's heaviest Opening Action at number 1, else the default opening, empty for narration-only openings; the Settings sample world reads the sample action (Q18). The executor's existing internal per-stat turn readings take a new name, so `turn` means one thing. Cards, the Variable menu and the Scripts guide cover `turn`.

This ticket reads the opening cue from the session. Ticket 02 saves it, so a re-roll or reload reads it too.

Spec: Q2, Q5–Q8, Q18, Q22, Q24, Q25, Q35, stories 1–3, 5–12, 44, 45, 47–50.

## Acceptance criteria

- [x] A Before the AI script reads `turn.action` as the player's trimmed text with `[OOC]` brackets kept, on a live turn — `GameViewer.turnRead.test.tsx` live-turn case; `scriptAction.test.ts`
- [x] `turn.number` reads the same value in Before the AI, After the AI, During AI Output and At Game Start of one turn, and equals that turn's `memories[].turn` once committed; a test covers the live turn, the stats re-roll and the full re-roll — `GameViewer.turnRead.test.tsx` (live, stats re-roll, page-one stats re-roll, full re-roll); `closedTurns` against `scriptMemories` in `scriptAction.test.ts`
- [x] The opening turn reads the player's edited cue, an untouched opening reads the drawn opening, and an Opening Narration start reads empty — edited and untouched in `GameViewer.turnRead.test.tsx`; the narration start in `scriptAction.test.ts` (unit only)
- [x] A player toggle between turns runs When a Trait Switches with an empty action and the last finished turn; before turn 1 it reads 0 — `GameViewer.turnRead.test.tsx` switch cases; a toggle mid-turn reads empty at the turn in progress (Q44)
- [x] A switch fired inside a turn (a script switch or a gate cascade) reads that turn's action and number — script switch in `GameViewer.turnRead.test.tsx` and `turnGlobal.test.ts`; gate cascades ride the same run state
- [x] A user Tool and an On Call World Tool read `turn`; a write to `turn.action` lists as a read-only write — `turnGlobal.test.ts`
- [x] Test Code reads the sample action at number 2; At Game Start in Test Code reads the heaviest Opening Action at number 1 — `turnGlobal.test.ts` (Test Code, Test Bench, the Q42 tie and bench rules)
- [x] Hover cards and the Variable menu list `turn`, `turn.action` and `turn.number` with type, access and help line; the Scripts guide has a Turn section — `codeCards.turn.test.ts`, `statCodeVariableTree.test.ts`; guide section by reading

## Blocked by

- None (can start immediately)

## Landed

**Not verified**
- A gate-cascade switch inside a turn has no test of its own. It runs over the same turn state as the tested script switch.
- A Formaquestion Tool or a Settings Try It run while a turn runs reads between turns (Q35). The path has no test: the help window and Try It are hard to reach mid-turn in the harness.
- The stats re-roll clears its turn reading in `runPartialRegen`'s `finally`, so a throw in its first script run cannot leave a stale reading. No test makes that run throw.

**For you**
- After a save load, a page-one stats re-roll reads a freshly drawn opening, not the save's cue, until ticket 02 saves the cue. Try a re-roll of page one after loading a save to see it.
- Read the Scripts guide's new Turn section (`docs/ScriptsGuide.md`) and the `turn` hover cards in the code editor for voice.
