# 45: Pronoun follow-ups

Status: ready-for-agent
Blocked by: 43, 44
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A follow-up that says "it", "them" or "that one" finds the earlier topic's sections (Q72). In ticket 39, every approach and mix stayed at 50–70% recall on follow-ups. Examples: "and how do I send it back to them after I change it?".

- Find why each missed follow-up in both sets misses, with the sources of ticket 44 on.
- Fix it in the search sources. Options to measure include giving the AI pick request the earlier question and answer, or resolving the pronoun from the earlier answer's sources.
- A follow-up that names a new topic still finds that topic.

**Probe.** Ticket 39's recall probe on follow-ups and tasks, both sets, and ticket 26's harness on follow-ups and tasks, default cloud model, 5 runs, with the current build as the in-batch control.

Recommended model rationale: follow-ups failed under every approach, so the cause needs reading before a fix.

## Acceptance criteria

- [ ] Each missed follow-up has a named cause in the handover
- [ ] Follow-up recall@5 rises on both sets; task recall does not drop more than the 5-point batch drift
- [ ] A follow-up that names a new feature still finds it; a test asserts it
- [ ] Probe numbers, fixed vs current build, same batch, are in the handover
- [ ] Four gates green
