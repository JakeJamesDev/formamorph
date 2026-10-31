# 10: Land Entity Writes from Start-Timing Scripts

Status: needs-triage
Blocked by: None (can start immediately)

## What to build

The opening fold lands no entity writes from a Start-timing script. A `meet()`, a move or a follow called there is dropped without a diagnostic. Moves and follows had this gap before Scene Presence; `meet()` adds one more. Land these writes on the opening state, or refuse them at Start timing with a diagnostic.

## Acceptance criteria

- [ ] A Start-timing script that calls `meet()` on a stranger makes that entity met on the first turn, or shows a diagnostic that says the call is not allowed there.
- [ ] Moves and follows from a Start-timing script follow the same choice.
- [ ] Each test fails when its old behavior is put back.
