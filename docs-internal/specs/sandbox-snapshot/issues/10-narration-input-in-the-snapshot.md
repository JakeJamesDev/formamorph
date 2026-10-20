# 10: Narration Input in the Snapshot

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

The last entry a caller still assembles moves behind the snapshot. Found by the spec review after tickets 01 to 09 landed; rulings Q1, Q5.

## What to build

An author runs a During AI Output Script in Test Code or the Bench and gets the same result as before. Behind it, the unit carries the sentence the Script rewrites, and the snapshot builds the narration input from it, the way it already resolves the `'sample'` switched trait. Test Code and the Bench stop calling the sample narration builder. Play keeps handing the snapshot its live narration input, since a real turn's narration carries more than a sentence.

## Acceptance criteria

- [ ] The unit takes a sentence for During AI Output, or play's full narration input. The snapshot builds the editor's narration input from the sentence.
- [ ] Test Code and the Bench pass the sentence only. Neither imports the sample narration builder; the sample sentence constant stays wherever the Bench reads it.
- [ ] The options table gains the During AI Output row from a sentence and asserts the built narration input.
- [ ] The parity test still passes for a During AI Output Script.
- [ ] Existing Test Code, Bench and turn tests stay green with no assertion change. The parity fixtures stay byte-equal.
- [ ] Four gates green, exit codes read.
