# 16: Voice keeps the guide flag

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

With the mascot on, an answer the guide does not cover still carries the Not in Guide marker as often as it does with the mascot off.

- Ticket 05's bar run passed, but under the Voice, uncovered questions missed the Not in Guide flag 24% against 10%, follow-ups invented control names 30% against 18%, and answers ran 260 tokens against 199. Two batches showed the same direction. The numbers are in ticket 05's Result section.
- The lever is the chip's fixed framing (Q39), not the player's Voice text: one more line that keeps the marker rule and the guide's names in force while the Voice applies. Change only the framing; the Voice itself stays the player's.
- Prove it the same way: one cloud batch, mascot on and off, the no-docs control, with the flag rate on uncovered questions, the invented-name rate on follow-ups, the answer length, and the bar score. The bar must still hold, and the flag rate must close most of the gap. Report every number, even when it moves the wrong way.
- Mascot off stays byte-equal to today's prompt.

Spec: Q22, Q26, Q39, Q41; Implementation → Help session.

Recommended model rationale: a prompt change judged on four numbers at once, where one wording nudges three of them.

## Acceptance criteria

- [ ] The off request body is unchanged.
- [ ] One batch reports both arms on the flag rate, the invented-name rate, the length and the bar score; the numbers are in this ticket.
- [ ] The on arm holds the bar and its flag rate on uncovered questions is within a few points of the off arm.
- [ ] The four gates are green.
