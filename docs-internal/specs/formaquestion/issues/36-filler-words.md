# 36: Filler words do not match

Status: ready-for-agent
Blocked by: 34
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Words like "here" and "this" stop pulling sections into the answer (Q60). In ticket 26, "what am I looking at here?" in the AI Context dialog sent the right section first, but a hit on "here" also sent the Help for This Screen section, and the model answered from it.

- The search ignores filler words that carry no topic, in the question and in the authored keyword lines.
- A section can still match its own control name when that name holds such a word, for example **Help for This Screen**.

**Probe.** Run ticket 26's harness on the here and task kinds, default cloud model, 5 runs, with the current build as the in-batch control.

Recommended model rationale: a word list with one exception rule.

## Acceptance criteria

- [ ] "What am I looking at here?" with no surface sends no Formaquestion section; a test asserts it
- [ ] "How do I use Help for This Screen?" still finds that section; a test asserts it
- [ ] Probe numbers, fixed vs current build, same batch, are in the handover
- [ ] Four gates green
