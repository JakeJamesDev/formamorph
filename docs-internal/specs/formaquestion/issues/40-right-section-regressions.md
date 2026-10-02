# 40: Regressions with the right section sent

Status: ready-for-agent
Blocked by: 37
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The user learns why six questions got worse even though their right section still reached the model (Q68). In ticket 37, the grounded-correct rate when the right section arrives fell from 92% to 86%. Follow-ups fell in tickets 34, 36 and 37 in a row.

| Question | Ticket 26 → 37 |
|---|---|
| `follow-publish-update` | 5/5 → 0/5, flagged in every run; three extra sections now reach it |
| `here-backup-dialog` | 5/5 → 0/5, answers about the Formaquestion window |
| `here-memory-tab` | 5/5 → 2/5 |
| `linkedcontent-1` | 5/5 → 2/5 |
| `worldeditor-1` | 5/5 → 3/5 |
| `follow-group-add` | 4/5 → 2/5 |

- For each question, compare the request at ticket 26's build and at the current build: sections, order and size.
- Rerun the six on both builds in one batch, default cloud model, 10 runs per arm. Each arm is the other's control.
- Name a cause for each: a change in the sections sent, or model drift (same input, different answer).
- For each cause in the sections, propose a fix. Build it here only if it is small and its probe shows the six recover without other kinds falling more than the 5-point drift. Otherwise hand it to the spec session.

Recommended model rationale: telling drift from a real change needs careful reading of requests and answers.

## Acceptance criteria

- [ ] Each of the six questions has a cause, backed by the request diff and the same-batch numbers
- [ ] Same-batch numbers, ticket 26 build vs current build, 10 runs per arm, are in the handover
- [ ] Any fix built here has probe numbers on all kinds; otherwise the proposed fixes are handed over
- [ ] Four gates green if code changed
