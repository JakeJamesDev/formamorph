# 06: Sign-in first for signed-out Report Bug

Status: ready-for-agent
Blocked by: 05 — Report Bug from Error Details
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A signed-out player presses **Report Bug** in Error Details. The age gate's authentication check runs first, as it does in the main menu, then the sign-in dialog opens. On success, the filled-in bug report opens with the error still in it. If the player cancels the check or the sign-in, Error Details stays open so they can still copy the error.

Sign-in becomes raisable from anywhere through the same store pattern Error Details uses, instead of main-menu state only. Sign-in in play must not reset the game view or lose the current turn.

Recommended model rationale: the spec names this the riskiest part of the effort; auth state, the age gate and three views interact.

## Acceptance criteria

- [ ] Signed out, Report Bug runs the authentication check and opens sign-in; signed in, it opens the report directly
- [ ] After a successful sign-in, the filled-in bug report opens with the same title and description
- [ ] Canceling the check or the sign-in leaves Error Details open with its details intact
- [ ] Sign-in raised in play keeps the game view and its state
- [ ] The main menu's existing sign-in behavior is unchanged
- [ ] Mutation check: skipping the authentication check fails a test
- [ ] Four gates green
