# 10: Mid-turn Clock Advance

Status: done
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: changes what every prompt reads for time within a turn, with a double-count trap at commit.

## What to build

A `clock.advance` made before a prompt is built shows in that prompt (Q45). Today every prompt in a turn reads the turn-start time, and the clock moves only at commit. After this ticket, a Before the AI or On Call advance moves the time that later prompts and later Tool calls read: a `sleep` Tool that Planning calls makes Narration read the morning. The commit adds only the part of the turn's duration not already shown, so no minutes count twice. Q27 still holds: the advances in a turn add up and set the turn's duration. Output and After the AI advances keep landing at commit (Q33).

Spec: Q27, Q44, Q45.

## Acceptance criteria

- [ ] A Narration prompt built after a Planning On Call `clock.advance(480)` shows the time 8 hours past the turn start
- [ ] A Before the AI `clock.advance(60)` shows in that turn's Narration prompt and the Time chip
- [ ] After commit, the clock sits at turn start plus the turn's duration, never more; a test proves no double count with both a Before and an On Call advance
- [ ] Regen and starvation tick once for the turn's hours (Q33)
- [ ] Regenerate restores the turn-start time
- [ ] The guard bites when the commit adds the shown minutes again
- [ ] Changelog fragment written
- [ ] Four gates green

## Blocked by

- 05 Arming, After The AI And On Call Writes

## Comments

- From ticket 05's trace: the Time chip and every prompt read `gameTime` (`chipTime = { elapsed: gameTime }` in GameViewer). Only the commit writes it: `handleTimePassed(commit.turnHours)` plus the code-duration correction. Before the AI clock writes sit in `beforeWorldWrites`, which only the commit context reads. Line numbers drift; search the names.
