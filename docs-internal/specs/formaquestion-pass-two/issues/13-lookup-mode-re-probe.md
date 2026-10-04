# 13: Lookup Mode re-probe

Status: ready-for-agent
Blocked by: 10
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Lookup Mode default follows a fresh probe on today's docs and search, not ticket 22's numbers.

- Ticket 28 found retrieval answering 48 of 48 completely at 1,653 input tokens against lookup's 45 of 48 at 3,090, after the keyword work changed the baseline. Ticket 10 flipped the default on from ticket 22's older 63% → 81%. Q46 reopens Q6 on that evidence.
- Run ticket 22's probe (`--lookup` arm against retrieval as the in-batch control) on MeroMero v2 31B with today's docs index and search sources, the same 18 questions, 3 runs per arm. Report complete answers, player-wording answers and input tokens per question for both arms, with failed runs counted as not complete.
- The run needs the GPU: ask the user for an AFK window before starting, and check what LM Studio has loaded first.
- Hand the numbers to the spec session. The user then rules: default on, or a follow-up flips it back to off. ADR 0009 line 20 is amended to match the ruling, in the ticket that applies it.

Spec: Q6, Q46; Testing → Other checks.

Recommended model rationale: a probe run with an in-batch control and a report the default rests on.

## Acceptance criteria

- [ ] Both arms ran in one batch on the same model and question set; the table is in the ticket's Answer.
- [ ] The spec session has the numbers and the user's ruling is recorded in the spec.
- [ ] No code change in this ticket.
