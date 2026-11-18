# Spec: Turn Landing

Status: ready-for-agent
Spec session: turn-landing — spec

One module lands a finished turn's results in one order. The live turn and the stat re-roll both use it, and the stat re-roll stops drifting from the live turn. Decision record: [ADR-0019](../../../docs/adr/0019-turn-landing-is-one-module-with-an-effects-port.md).

## Problem Statement

A player who re-rolls a turn's stats can get results the turn itself could never have produced.

- A stat or trait change that a During AI Output script made disappears after the re-roll.
- A re-roll can add or skip the starvation penalty that the turn did not.
- When an After the AI script advanced the clock, the re-rolled stat code and regen see a different turn length.
- A script that checks who is present can take a different branch in the re-roll.
- A memory pin that a script made from the old stats stays after the stats change.
- A Stop during the re-roll can leave the turn half put back.

The cause is in the code's shape. The view holds two hand-written copies of the landing order: one for the live turn and one for the stat re-roll. The order is the logic, and it lives in comments. The copies have drifted, and one earlier drift bug is already recorded in the re-roll copy. Only tests that mount the whole game view can reach either copy.

## Solution

The Turn Landing becomes one module outside React. It owns every step from the During AI Output writes to the armed snapshot. The live turn and the stat re-roll are two modes of it. Each step the re-roll skips is named in the module.

The player sees a stat re-roll that replays the turn as it ran: the same script inputs, the same turn length, the same starvation check, and script memory that follows the new stats. A stopped re-roll puts the turn back whole.

## Rulings

- **Q1.** The Turn Landing owns the whole landing. The stat re-roll is a mode of it, and the module names the steps that mode skips.
- **Q2.** The module is React-free. The view passes one effects port of trusted callbacks, as it passes the derivation callback in ADR-0001.
- **Q3.** Drift between the live turn and the stat re-roll is fixed in this effort. Where the two differ with no recorded reason, the re-roll takes the live turn's behavior.
- **Q4.** The choices re-roll stays outside the Turn Landing. It shares only the turn patch and the snapshot arming.
- **Q5.** The landing starts at the During AI Output writes, after the reveal hold. It ends when the snapshot is armed and the before box's undo is cleared. The move offer, the reveal hold, the turn count, the started flag and the scene image stay in the view.
- **Q6.** Every mounted game-view test stays as it is. New tests at the module's interface are added. Pruning duplicates is a later decision.
- **Q7.** A new ADR records the module and its port. The glossary gets a Turn Landing entry. ADR-0001 gets a pointer.
- **Q8.** Landing order: first extract the live landing with no behavior change; then route the stat re-roll through it with every difference kept as a named mode difference; then one ticket per fix.
- **Q9.** Fix. A Stop during a stat re-roll puts the whole turn back, bar deltas and page snapshot included. The ticket starts with a test that reproduces the fault; if it does not reproduce, the ticket closes with that finding.
- **Q10.** Fix. The stat re-roll lands the turn's During AI Output writes as saved, with no script run, as it does for On Call writes.
- **Q11.** Fix. The starvation check reads the pre-turn stats in both modes. The re-roll matches the live turn.
- **Q12.** Fix. The stat re-roll runs stat code with the turn's duration from before After the AI clock writes, then ticks the extra hours after the code, as the live turn does.
- **Q13.** Fix. Scripts replayed by the stat re-roll read the cast and the location that the live turn gave them.
- **Q14.** Fix. The stat re-roll re-makes a script's meets, memory pins, named memory writes and memory edits. This changes the keep rule in the Script Run Order spec for memory.
- **Q15.** Fix, in its own ticket. The choices re-roll fires the turn's After Tool calls again.
- **Q16.** Fix. In a stat re-roll, the later scripts of the turn read the scripted choices, as in the live turn.
- **Q17.** Additive fields on the saved turn are allowed for Q10, Q12 and Q13. A turn saved without them re-rolls as it does today.
- **Q18.** The stat re-roll also re-makes lines a script appended to the turn's memory and script diary lines. Location, time and scene entities stay kept.
- **Q19.** Two test seams: the Turn Landing's interface with a recording fake port, and the existing mounted game-view tests. Q9 and Q15 are tested mounted, because their code stays in the view.

- **Q20.** Saved-turn fields. Ticket 06 adds the During AI Output writes in the shape a saved On Call write uses. Ticket 07 adds one number: the turn's hours before After the AI clock writes, absent when it equals the stored hours. Ticket 08 uses the pre-turn snapshot where it can, and brings any new field to the user through the spec session before it adds one.

## User Stories

1. As a player, I want a stat re-roll to keep what a During AI Output script changed, so that a trait the narration turned on does not vanish.
2. As a player, I want a stat re-roll to apply the starvation penalty exactly when the turn applied it, so that a re-roll never costs Health the turn did not.
3. As a player, I want a re-rolled turn to charge the same hours to stat code as the turn did, so that per-hour script math gives comparable numbers.
4. As a player, I want regen in a re-roll to tick in the same order as in the turn, so that a stat near its cap lands the same way.
5. As a player, I want a script that checks who is present to see the same cast in a re-roll, so that it takes the same branch for the same scene.
6. As a player, I want a script that checks my location to see where the turn ran, so that a turn that moved me does not re-roll as if it began at the destination.
7. As a player, I want a memory pin a script made from my stats to follow the re-rolled stats, so that memory never states something the stats no longer support.
8. As a player, I want a named memory a script wrote to be rewritten by the re-roll, so that its text matches the new result.
9. As a player, I want a character a script marked as met to be met only when the re-rolled script still says so.
10. As a player, I want lines a script appended to the turn's memory to be made again by the re-roll, so that they match the new stats.
11. As a player, I want script diary lines to be made again by the re-roll, so that a character's diary matches what happened.
12. As a player, I want a re-roll to leave my location, the clock and the scene's cast alone, so that a stat re-roll never rewrites the scene.
13. As a player, I want Stop during a re-roll to put the turn back exactly as it was, so that I never play on from a half-applied state.
14. As a player, I want the stat bars to show the turn's changes again after a stopped re-roll, so that the bars match the stats.
15. As a player, I want paging back after a stopped re-roll to show the turn as it was, so that the page snapshot is never a mid-re-roll state.
16. As a player, I want Re-generate Choices to apply a Tool's choice edit again, so that the new list has the same Tool effects as the old one.
17. As a player, I want scripts that run late in a re-rolled turn to read the choices the scripts set, so that an item script sees the same list as in the turn.
18. As a player with a save from before this change, I want re-rolls of old turns to work as they did, so that loading an old save breaks nothing.
19. As a player, I want the live turn to play exactly as before, so that this change costs me nothing in normal play.
20. As a world author, I want a stat re-roll to run my scripts over the same inputs as the turn, so that I can reason about my world's rules once.
21. As a world author, I want During AI Output scripts to count in re-rolled turns, so that their effects are as reliable as After the AI scripts.
22. As a world author, I want a Script World Tool's After call to fire in a choices re-roll, so that Tool-driven choices stay consistent.
23. As a developer, I want the landing order in one module, so that a new step is added once.
24. As a developer, I want each step the stat re-roll skips to be named in the module, so that a skipped step is a decision and never an omission.
25. As a developer, I want to test the landing order without mounting the game view, so that an order bug fails a fast test.
26. As a developer, I want one test that lands the same commit in both modes and compares the results, so that drift fails a test when it appears.
27. As a developer, I want the mounted tests untouched during the refactor, so that the safety net does not move with the code.
28. As a developer, I want each drift fix in its own ticket, so that a regression traces to one change.
29. As a developer, I want the game view to shrink by the landing and the re-roll's copy, so that the god node loses a cluster.

## Implementation Decisions

- **The module.** The Turn Landing sits with the Turn Pipeline, after the commit computation. It is a plain async operation outside React. It takes the Turn Commit, the turn's own locals, the mode, and the effects port.
- **The effects port.** One object of trusted callbacks that the view supplies. Its entries are the existing domain operations the landing calls today: land the output run, land the Inventory pass, apply stat changes, run stat code, pass time, tick regen, place followers, write the stored turn, land memory writes, settle the turn, run item events, arm the snapshot. The port has one production implementation. It is not a plugin point (ADR-0019).
- **Pure helpers stay direct imports.** Functions that compute from plain values (entity moves, code-write merge, called-over characters) are called by the module itself and are not port entries.
- **Reads.** Values fixed for the whole landing arrive as plain input. Values that can change across an await are read through the port at the moment of use.
- **Order (live mode).** Output-run writes → cast book for the pass → Inventory pass → bar delta reset → stat changes with the After the AI batch → time passes → wait for stat code → code writes merged → scripted choices → extra hours → code move → meets → follower placement → stored turn → memory pins, named writes, memory writes → discoveries → settle → item events → snapshot armed → before-box undo cleared.
- **Stat re-roll mode.** It runs the same order over the saved turn. It skips, by name: the code move, the clock advance, discoveries, follower placement, and the move offer clear. Everything else lands. After the fixes, the mode's inputs are: the saved Inventory pass, the saved On Call writes, the saved During AI Output writes, the saved pre-code duration and the saved pass cast.
- **The reset to pre-turn stays in the view.** The re-roll's reset before the replay, and its restore on Stop, are not part of the landing. Q9 fixes the restore where it is. It moves only if the code-state transaction is built later.
- **Memory in a re-roll (Q14, Q18).** Script memory writes are keyed by turn where they already are (pins, named writes). The re-roll removes the turn's script memory and lands the replay's. Meets and memory edits return to the pre-turn snapshot first, then the replay's land.
- **Save shape (Q17).** This effort changes the save export shape. Up to three optional fields join the saved turn: the During AI Output writes (same shape as a saved On Call write), the turn's duration before After the AI clock writes, and the cast book the Inventory pass was placed with. Each is absent when the turn has nothing to store. A turn without a field re-rolls as it does today for that part. No migration and no version step. World files do not change. Q20 settles the first two fields and how the third is ruled.
- **Choices re-roll (Q15).** It passes the replay's After triggers to its script rerun. Nothing else about it changes.
- **ADR-0001.** Its decision stands. Its sentence that the apply step is thin setters no longer describes the code; ADR-0019 covers the landing.
- **Script Run Order spec.** Its rule that a stat re-roll keeps memories and diary lines is replaced by Q14 and Q18. Location, time and scene entities stay kept.

## Testing Decisions

- A good test lands a commit and asserts what the game would then hold or do: the calls the port received, in order, with the arguments that matter. It never asserts a private helper of the module.
- **Seam A, the Turn Landing's interface.** A recording fake port. Cover: the live order; the re-roll order with each skipped step absent; the same commit landed in both modes gives the same stat inputs (threshold stats, duration, cast, location); During AI Output writes land in a re-roll; extra hours tick after code in both modes; script memory is removed and re-made in a re-roll; scripted choices reach the later scripts; a saved turn without the new fields takes today's path. Prior art: the turn runner tests with a fake request adapter and a fake advance, and the commit computation tests.
- **Seam B, the mounted game view.** The existing tests stay untouched and must stay green through the extraction and the routing tickets. New mounted tests cover Q9 (Stop during a stat re-roll, with and without a before-box write) and Q15 (After Tool calls in a choices re-roll). Prior art: the existing stat re-roll and Stop tests of the game view.
- **No behavior change tickets.** The extraction ticket and the routing ticket change no test expectation. A changed expectation there is a finding to report, not a fix to make.
- **Fix tickets.** Each starts from a failing test that shows the drift. Prove each guard bites by reinstating the old behavior and watching the test fail.
- Never rig a scenario so a step cannot fire. A re-roll test uses a world whose scripts really write at the timing under test.

## Out of Scope

- The turn session: the per-turn state inside the derivation callback (architecture review candidate 6).
- The code-state transaction over the gameplay setters (candidate 2).
- The live Sandbox State assembly (candidate 3).
- Moving the reveal hold, the move offer, the turn count or the scene image out of the view.
- Rewriting mounted tests as interface tests.
- A choices-only mode in the Turn Landing.
- Any change to live-turn behavior. Where the two modes differ, the re-roll moves.

## Further Notes

- The nine differences came from reading source on 2026-11-18. None was reproduced in the running game before this spec. Each fix ticket reproduces its own first.
- Differences already recorded as intended stay: a stat re-roll redoes stats and not the scene (World Tools Q31), it replays the saved Inventory pass (Q53, Q62), and it replays On Call writes as saved (Q39, Q41).
- Fix tickets Q10, Q12 and Q13 each add a saved-turn field, so each carries the export-shape reminder.
- Player-visible fixes each get a changelog entry. The extraction and routing tickets get none.
