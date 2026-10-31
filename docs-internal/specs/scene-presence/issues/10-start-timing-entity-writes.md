# 10: Land Entity Writes from Start-Timing Scripts

Status: wontfix
Resolution: No write is lost. A live cloud repro (two runs, identical) used a Start script that moves Ash, has Bram follow, and meets Cora. Turn one landed all three. A stat re-roll kept them. A full re-roll of page one returned to the pre-game state, and the resubmit landed all three again. Q75 and Q76 rested on an untraced review claim.
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The opening fold lands no entity writes from a Start-timing script. A `meet()`, a move or a follow called there is dropped without a diagnostic. Moves and follows had this gap before Scene Presence; `meet()` adds one more. The opening state lands these writes (Q75), so a Start script can place, attach or introduce entities before turn one.

## Acceptance criteria

- [ ] A Start-timing script that calls `meet()` on a stranger makes that entity met on the first turn.
- [ ] A Start-timing move places the entity, and a follow attaches it, on the first turn.
- [ ] The Scripts guide describes what Start timing can write.
- [ ] Each test fails when its old behavior is put back.
