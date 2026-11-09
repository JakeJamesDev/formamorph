# 08: Chat Regenerate Keeps the Send State

Status: done
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

A close-review gap in ticket 07: the Chat re-roll path drops the record it restored from.

## What to build

A player in the Chat layout drinks a potion, sends, and regenerates twice. Today the first regenerate keeps the potion used (Q55), but it clears the list, so the resent turn records no state at send. The second regenerate, or a Regenerate Stats on that turn (Q53), falls back to the previous page's snapshot and reverts the potion. After this ticket, every Chat re-roll of that turn starts from the same state at send.

Spec rulings: Q15, Q53, Q55.

## Acceptance criteria

- [x] A second Chat regenerate of a turn sent with a list keeps the listed actions applied; a test that fails on today's code covers it. (`keeps the listed actions on every Chat regenerate of the turn` in `GameViewer.tellNarrator.test.tsx`; failed on Base with 3 tonics, not 2.)
- [x] Regenerate Stats after a Chat regenerate keeps the listed actions applied; a test covers it. (`starts Regenerate Stats after a Chat regenerate from the state at send`; failed on Base with Calm 50, not 90.)
- [x] The resent turn's record keeps the original entries and hidden flags, so the sent page still shows them. (Same first test: the record after two regenerates equals the original, hidden flag included.)

## Landed

The resent Chat turn records the regenerated turn's own record (entries, hidden flags, state at send) in place of the cleared live list. No changelog line: the bug never shipped, and ticket 07's entry already states the behavior.

**Not verified**

- None.

**Review note (from reading the source, not run):** a turn that fails or is stopped before it commits loses its sent record in either layout, so a later regenerate reverts the listed actions. This predates ticket 07 and is out of this ticket's scope.

**For you**

- In the Chat layout, use an item, send, then regenerate twice: the item stays used. Switch to Pages to see the sent rows.
