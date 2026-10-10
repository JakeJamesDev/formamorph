# 06: Seal on Place Change

Status: done
Blocked by: 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: one added condition in the merge rule, with tests at the history module.

Parent: [History Reveal Origin spec](../spec.md)

## What to build

Two writes merge into one Step only when their Origins match. A difference in tab, selection, sub-view or field starts a new Step, even within the typing pause (Q10). Writes without an Origin merge as before.

## Acceptance criteria

- [ ] A write from a different field within the pause starts a new Step.
- [ ] A write from a different tab, selection or sub-view within the pause starts a new Step.
- [ ] Typing in one field still merges into one Step.
- [ ] Writes without an Origin merge as before.
- [ ] History module tests. The seal test fails when the Origin check is removed from the merge rule.
