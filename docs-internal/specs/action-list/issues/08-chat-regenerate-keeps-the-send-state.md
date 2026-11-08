# 08: Chat Regenerate Keeps the Send State

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

A close-review gap in ticket 07: the Chat re-roll path drops the record it restored from.

## What to build

A player in the Chat layout drinks a potion, sends, and regenerates twice. Today the first regenerate keeps the potion used (Q55), but it clears the list, so the resent turn records no state at send. The second regenerate, or a Regenerate Stats on that turn (Q53), falls back to the previous page's snapshot and reverts the potion. After this ticket, every Chat re-roll of that turn starts from the same state at send.

Spec rulings: Q15, Q53, Q55.

## Acceptance criteria

- [ ] A second Chat regenerate of a turn sent with a list keeps the listed actions applied; a test that fails on today's code covers it.
- [ ] Regenerate Stats after a Chat regenerate keeps the listed actions applied; a test covers it.
- [ ] The resent turn's record keeps the original entries and hidden flags, so the sent page still shows them.
