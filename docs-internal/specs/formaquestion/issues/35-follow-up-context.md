# 35: Follow-ups keep their topic

Status: ready-for-agent
Blocked by: 32
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A follow-up with a generic verb stays on the earlier answer's topic (Q60). Follow-ups scored 34% grounded-correct in ticket 26, the lowest English kind. "How do I test it?" after making a Tool found the Test Bench. "How do I create another one first?" found the Group how-to. "Can I cap how many of those they take?" after a trait requirement found Limit Active Characters.

- When a question has history, sections from the page of the previous answer's sources rank above other matches of the same strength.
- A follow-up that names a new topic outright still finds that topic.

**Probe.** Run ticket 26's harness on the follow-up and task kinds, default cloud model, 5 runs, with the current build as the in-batch control. Report grounded-correct and right-source per kind.

Recommended model rationale: the weight must help vague follow-ups without trapping a real topic change.

## Acceptance criteria

- [ ] "How do I test it?" after a Tool answer sends a Tools section; a test asserts it
- [ ] A follow-up that names another feature sends that feature's section; a test asserts it
- [ ] Probe numbers, fixed vs current build, same batch, are in the handover; task questions do not drop by more than the 5-point batch drift
- [ ] Four gates green
