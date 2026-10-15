# 11: Test Code And Test Bench

Status: done
Blocked by: 02, 06, 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the editor's test path meets prompts, output scripts and five timings at once.

## What to build

Test Code on any script shows the real prompt dialogs in the editor (Q24). A During AI Output script tests against a sample sentence the author types, with `sent`, `buffered` and `full` stubbed from it. The Test Bench runs every timing, reports a script error by script name and timing (Q22), and warns on two writers of one field within a timing as it does today.

Spec: Q22, Q24, story 13.

## Acceptance criteria

- [ ] Test Code on a script with `player.confirm` shows the choice row in the editor and completes with the pick
- [ ] Test Code on a During AI Output script takes a sample sentence and shows the rewritten one
- [ ] A Test Bench finding names the script by its name or owner-and-timing fallback
- [ ] Four gates green

## Blocked by

- 02, 06, 09

## Comments

From ticket 05: Test Code and the Test Bench give no `trait` in a When a Trait Switches box, so a script that reads it fails there. Supply a sample `trait` for that timing.
