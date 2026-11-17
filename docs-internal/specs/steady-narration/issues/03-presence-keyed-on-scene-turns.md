# 03: Presence Keyed on Scene Turns

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Presence recomputes only when the recent scene turns' content changes, not on every history write (Q6).

- Presence derives the recent scene turns and memoizes them by a plain content key. It does not build a generic stable-map helper; ticket 02 owns that one.
- A history write that leaves the recent scene turns unchanged, such as a background pass result, leaves presence unchanged.

## Acceptance criteria

- [x] A history change outside the recent scene turns keeps presence the same object. (`usePresence.sceneTurns.test.tsx`, user message and out-of-window edit)
- [x] A change to a recent scene turn's text gives a new presence. (Test changes the turn's participants. The key is the derived scene turns, so a text edit that changes no participant keeps presence.)
- [x] Reverting to a plain history dependency makes the first test fail. (Mutation run: first test red, second green.)
- [x] Existing presence tests pass unchanged. (`presence.test.ts`, 50 tests green, no edits.)

## Landed

**Not verified**
- The `viewedPage` snapshot path (sliced history) has no test of its own.
- No changelog fragment: the ticket alone changes nothing a player sees.

**For you**
- Nothing for a player to judge in this ticket.
