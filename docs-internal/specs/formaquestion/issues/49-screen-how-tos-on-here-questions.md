# 49: Screen how-tos only on "here" questions

Status: ready-for-agent
Blocked by: 47
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A task question asked over an open screen keeps room for its own sections (Q78). In the app, every question has an open screen. Ticket 47 measured task recall@5 over an open screen at 54–62%, against 79% with no screen. The screen's section and its page's how-tos (ticket 32) take up to three of the five slots.

- The screen's page how-tos join the docs block only when the question says "here", "this" or "these", the same gate as Q77.
- The screen's section still leads every question.
- "How do I add one here?" still gets the screen's how-to; ticket 32's test still passes.

**Probe.** The recall probe with its screen option, over the same three screens as ticket 47, on both sets; and ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control.

Recommended model rationale: one gate, but it must not undo ticket 32's "here" gain.

## Acceptance criteria

- [ ] A task question with no here/this/these over an open screen gets no on-page how-to; a test asserts it
- [ ] "How do I add one here?" still gets the screen's how-to; a test asserts it
- [ ] Task recall@5 over an open screen rises on both sets; "here" grounded-correct stays within the 5-point drift; same batch
- [ ] Four gates green
