# 09: Stopped Turn Keeps Its List

Status: done
Blocked by: 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A possible gap the ticket 08 session found by reading the source, not by running it. Reproduce it before you fix it.

## What to build

A player drinks a potion from the panel, sends, and the turn fails or is stopped before it commits. Then the player regenerates. The report is that the turn's sent list is lost, so the regenerate falls back to the previous page's snapshot and reverts the potion. After this ticket, a failed or stopped turn keeps its listed actions: a regenerate restores the state at send, on Pages and in Chat.

Spec rulings: Q15, Q51, Q55.

## Acceptance criteria

- [x] A test reproduces the loss first, for a failed and for a stopped turn, or the Landed section shows that it does not happen. `GameViewer.stoppedTurnList.test.tsx`: a turn that fails or is stopped before its narration lands loses its list (6 tests red on base). A turn stopped after its narration started keeps it (see Landed).
- [x] If it reproduces: a regenerate after a failed or stopped turn keeps the listed actions applied, on Pages (the list reopens, Q51) and in Chat (Q55); each test fails on today's code. "leaves the turn before it regenerating … (Q51)" and "… in Chat … (Q55)", for both ends; red on base, and red again with the sent-list restore removed.
- [x] The live list is not lost or told twice when a stopped turn is sent again. "gives its list back to the live list, and the next send tells it once" (fail and stop) and "a Chat regenerate that fails"; red again with the live-list restore removed.

## Landed

The loss happens only when the turn leaves no message in history: a failure, an empty narration, or Stop before any text. The send closes the live list, and `recordSent` drops the previous turn's snapshots, so its regenerate fell back to `regenerateState`. The between-turns prune effect in `GameViewer.tsx` now puts back the pre-send live list and sent lists when the sent turn id is not in history.

A turn stopped after its narration started did not reproduce. Its partial message carries its turn id, so its record survives. The two "stopped after its narration started" tests pass on base and stay as regression guards.

**Not verified**

- A save loaded while a turn runs now clears the pending restore. No test covers it; I did not check whether Load is reachable mid-turn.

**For you**

- Play a turn with a Tonic used, stop it before text appears: the Since Last Turn tray shows the row again, and Send tells it once.
