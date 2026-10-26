# 05: Re-Roll Choices Rerun

Status: done
Blocked by: 03 — Choices Write And Landing
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the choices re-roll gains the replay state the stats re-roll builds, a choices-only run mode beside the triggers-only one, and a silent prompt host that answers instead of canceling.

## What to build

In a world that can change choices, **Re-Roll Choices** draws new choices from the AI, then reruns the After the AI scripts with only their choice writes landing; every other write drops (Q10). The rerun replays the turn as the stats re-roll does: the pre-turn state with the before box and the turn's asks laid over it, so scripts read the same `previous` and `delta` the original run did (Q19). The `player` calls are silent on that rerun: `tell` and `toast` show nothing, `confirm` answers false, `ask` answers nothing picked (`[]` with `multiple`), `input` answers empty, and the script runs on (Q20). That is a new prompt host mode: the listener-less store cancels an ask and fails the script. The re-roll starts from the new AI list, never from an earlier edit, stores the AI list and the shown list on the turn, and a stopped or failed re-roll puts the turn's own lists back. In other worlds the re-roll stays the plain choices request it is today. The changelog fragment folds it into the choices entry.

Spec: Q10, Q19, Q20, story 19.

## Acceptance criteria

- [x] In a scripting world, a choices re-roll shows the new AI list with the script's removal applied, and the turn record holds the AI list and the shown list: `GameViewer.choicesWrite.test.tsx` "shows the new draw once…" (the draw never renders before the rerun lands; dropping the hold turns it red)
- [x] On the rerun a stat write, a trait write and a `discover` call land nothing; the stats, traits and cast stand as before the re-roll: view test "lands no stat write, trait switch or discover from the rerun"; `turnChoicesWrite.test.ts` "lands the choices write and drops…"
- [x] On the rerun a `confirm` answers false and a `tell` shows nothing; the script's choice write after the call lands: view test "answers a confirm with false and shows no tell…"; executor test "answers every player call at once…" (`ask` `null`, `[]` with `multiple`, `input` `""`)
- [x] A script that gates a choice on `self.delta` reads the turn's delta on the rerun, as the original run did: view test "reads the turn's delta on the rerun…", and "reads it from the stored changes…" for a turn saved without `statAsks` (Q28)
- [x] A stopped re-roll puts the turn's choices back as they were: view test "puts the turn's lists back when stopped"
- [x] In a world with no `turn` in its After the AI boxes, the re-roll sends the plain request and runs no script: view test "sends the plain request and runs no script" (`runStatCodeTurn` spy)
- [x] Reinstating the cancel-on-ask host for the rerun turns the silent-call test red: mutated the choices-only host to `createScriptPromptStore()`; the view's silent-call test and the executor's went red; restored
- [ ] The Scripts guide's re-roll note covers choices; the changelog fragment folds it into the choices entry: guide section "Change the choices" covers it; the fold is not done (see Not verified)

## Blocked by

- 03 — Choices Write And Landing

## Landed

**Not verified**

- The changelog fold into the choices entry. A ticket fragment always lands as its own entry, so the rerun is its own line under **Scripts**. The spec session can merge it on the main checkout.
- Untested paths in the rerun: a replayed turn with On Call writes, a rerun that cannot start (no pre-turn state), and the two error catches. They mirror the stats re-roll.

**For you**

- ⚠️ Save shape: each stored turn gains `statAsks` (additive), the stat tracker's asks by owner and stat (Q28). A turn saved before it replays `stat_changes`.
- In a world whose After the AI scripts name `turn`, **Re-generate Choices** now shows nothing until the scripts finish, then the scripted list. Try it on the cloud model and judge the wait.
