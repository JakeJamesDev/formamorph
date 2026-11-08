# 09: Stopped Turn Keeps Its List

Status: ready-for-agent
Blocked by: 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A possible gap the ticket 08 session found by reading the source, not by running it. Reproduce it before you fix it.

## What to build

A player drinks a potion from the panel, sends, and the turn fails or is stopped before it commits. Then the player regenerates. The report is that the turn's sent list is lost, so the regenerate falls back to the previous page's snapshot and reverts the potion. After this ticket, a failed or stopped turn keeps its listed actions: a regenerate restores the state at send, on Pages and in Chat.

Spec rulings: Q15, Q51, Q55.

## Acceptance criteria

- [ ] A test reproduces the loss first, for a failed and for a stopped turn, or the Landed section shows that it does not happen.
- [ ] If it reproduces: a regenerate after a failed or stopped turn keeps the listed actions applied, on Pages (the list reopens, Q51) and in Chat (Q55); each test fails on today's code.
- [ ] The live list is not lost or told twice when a stopped turn is sent again.
