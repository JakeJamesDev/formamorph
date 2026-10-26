# 05: Re-Roll Choices Rerun

Status: ready-for-agent
Blocked by: 03 — Choices Write And Landing
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the choices re-roll gains the replay state the stats re-roll builds, a choices-only run mode beside the triggers-only one, and a silent prompt host that answers instead of canceling.

## What to build

In a world that can change choices, **Re-Roll Choices** draws new choices from the AI, then reruns the After the AI scripts with only their choice writes landing; every other write drops (Q10). The rerun replays the turn as the stats re-roll does: the pre-turn state with the before box and the turn's asks laid over it, so scripts read the same `previous` and `delta` the original run did (Q19). The `player` calls are silent on that rerun: `tell` and `toast` show nothing, `confirm` answers false, `ask` answers nothing picked (`[]` with `multiple`), `input` answers empty, and the script runs on (Q20). That is a new prompt host mode: the listener-less store cancels an ask and fails the script. The re-roll starts from the new AI list, never from an earlier edit, stores the AI list and the shown list on the turn, and a stopped or failed re-roll puts the turn's own lists back. In other worlds the re-roll stays the plain choices request it is today. The changelog fragment folds it into the choices entry.

Spec: Q10, Q19, Q20, story 19.

## Acceptance criteria

- [ ] In a scripting world, a choices re-roll shows the new AI list with the script's removal applied, and the turn record holds the AI list and the shown list
- [ ] On the rerun a stat write, a trait write and a `discover` call land nothing; the stats, traits and cast stand as before the re-roll
- [ ] On the rerun a `confirm` answers false and a `tell` shows nothing; the script's choice write after the call lands
- [ ] A script that gates a choice on `self.delta` reads the turn's delta on the rerun, as the original run did
- [ ] A stopped re-roll puts the turn's choices back as they were
- [ ] In a world with no `turn` in its After the AI boxes, the re-roll sends the plain request and runs no script
- [ ] Reinstating the cancel-on-ask host for the rerun turns the silent-call test red
- [ ] The Scripts guide's re-roll note covers choices; the changelog fragment folds it into the choices entry

## Blocked by

- 03 — Choices Write And Landing
