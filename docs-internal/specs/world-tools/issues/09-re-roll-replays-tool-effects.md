# 09: Re-roll Replays Tool Effects

Status: done
Blocked by: 05, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a save-shape change plus a replay seam that must keep re-rolled stats consistent with text already shown.

## What to build

A turn remembers the Tool calls it made and the writes its On Call Tools made. A stat re-roll then replays the turn's Tool effects instead of dropping them (Q39, Q41). After the AI triggers run again with their saved args. On Call scripts do not run again: the re-roll reapplies their saved writes, so a random result stays what the narration says. Output triggers follow what a re-roll does for output Scripts. A regenerate still drops everything (Q2). Split from ticket 05 (Q42); until this lands, a re-roll drops Tool effects.

Spec: Q39, Q41, Q42; story 36.

## Acceptance criteria

- [ ] The turn stores its Tool calls (Tool id, args, timing) and its On Call writes; a save round-trips them, and a save without them loads unchanged
- [ ] A re-roll after an After the AI Tool call re-runs the trigger with the saved args, and its stat write survives
- [ ] A re-roll after an On Call `roll` reapplies the saved write without running the script; the value matches the first run
- [ ] A regenerate drops the saved calls and writes with the turn
- [ ] Each guard bites when its bug returns (trigger skipped; On Call script re-run)
- [ ] Save-shape reminder in the landing report; changelog fragment written
- [ ] Four gates green

## Blocked by

- 05 Arming, After The AI And On Call Writes
- 06 During AI Output Triggers
