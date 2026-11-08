# 07: Regenerate Reopens the List

Status: ready-for-agent
Blocked by: 02, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Touches rollback and regenerate, which restore page snapshots; easy to get subtly wrong.

## What to build

A player drinks a potion, sends, and regenerates the turn. Today the regenerate restores the snapshot from before the potion and silently reverts it. After this ticket, regenerate restores the pre-turn state with the turn's listed actions reapplied, and reopens the list as the live list, editable: the player can hide or undo before resending. The sent list on the turn record and its snapshots make this possible.

Spec rulings: Q14, Q15.

## Acceptance criteria

- [ ] Regenerating a turn whose list had entries keeps those actions applied; a test that fails on today's behavior covers it.
- [ ] The regenerated turn's list reopens with the same entries and hidden flags, and undo works on it.
- [ ] Hiding or undoing an entry before the resend changes what the resent turn carries.
- [ ] Regenerating a turn with an empty list behaves as today.
- [ ] Rollback to an earlier page does not reopen a list.
