# 07: Regenerate Reopens the List

Status: done
Blocked by: 02, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Touches rollback and regenerate, which restore page snapshots; easy to get subtly wrong.

## What to build

A player drinks a potion, sends, and regenerates the turn. Today the regenerate restores the snapshot from before the potion and silently reverts it. After this ticket, regenerate restores the pre-turn state with the turn's listed actions reapplied, and reopens the list as the live list, editable: the player can hide or undo before resending. The sent list on the turn record and its snapshots make this possible.

Spec rulings: Q14, Q15.

## Acceptance criteria

- [x] Regenerating a turn whose list had entries keeps those actions applied; a test that fails on today's behavior covers it. (tellNarrator "keeps the listed actions applied…"; red with the reopen disabled. Regenerate Stats: the Q53 test, red with `after` ignored. Chat: the Q55 test, red with the send-time restore removed.)
- [x] The regenerated turn's list reopens with the same entries and hidden flags, and undo works on it. ("reopens the entries with their hidden flags, and undo works on them")
- [x] Hiding or undoing an entry before the resend changes what the resent turn carries. ("sends what the player changed before the resend")
- [x] Regenerating a turn with an empty list behaves as today. ("re-sends at once when the turn had no list, as before")
- [x] Rollback to an earlier page does not reopen a list. ("does not reopen a list on a rollback")

## Landed

**Not verified**
- The Q57 fallback (a saved record whose snapshots were dropped re-rolls from the pre-turn state) has a unit test for `reopenSent` only, not an in-game test.

**For you**
- Use a potion, send, press Regenerate Narration: the potion stays used, the tray comes back, and your action is in the box until you press Send (In Game).
