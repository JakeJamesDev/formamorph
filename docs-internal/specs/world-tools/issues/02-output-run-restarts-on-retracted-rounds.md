# 02: Output Run Restarts On Retracted Rounds

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: streaming state across tool rounds, where a wrong landing point keeps writes from text the player never kept.

## What to build

When a narration round ends in Tool calls, the Request Transport retracts the text it showed. Today's During AI Output Scripts may already have run on that text. Those writes now drop, and the output run starts over with the next round's sentences (Q9). The kept narration and the landed writes always match. This is a prefactor for output triggers (ticket 06), and it fixes the case for output Scripts on its own.

Spec: Q9; story 38.

## Acceptance criteria

- [ ] With an output Script that counts sentences into a stat, a fake stream with a retracted round lands only the count of the kept round's sentences
- [ ] A sentence rewrite made on retracted text never reaches the screen, the save or TTS
- [ ] `narration.index` starts from 0 on the restarted run
- [ ] The guard bites: keeping the retracted writes fails the test
- [ ] Changelog fragment written
- [ ] Four gates green

## Blocked by

- None (can start immediately)
