# 46: Help baseline against the bar, second run

Status: ready-for-agent
Blocked by: 43, 44, 45, 47
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The user learns whether Formaquestion now meets the 80% bar (Q59, kept in Q72). Run ticket 37's measurement again on the build with tickets 43, 44, 45 and 47 and the shipped source defaults.

- Default cloud model, ticket 26's 125 questions, both arms, 5 runs, the same keys. Change no key.
- The bar: 80% grounded-correct over the English task, "here" and follow-up questions together. Report each kind next to tickets 26 and 37.
- Also report ticket 39's blind-set recall for the shipped defaults, since the known set flatters the search.
- A result inside 5 points of the bar gets a second batch before any verdict.
- Under the bar: list the worst questions with causes and hand them to the spec session. Do not tune the prompt here.

Recommended model rationale: the verdict and the cause list decide what comes next.

## Acceptance criteria

- [ ] One full batch with no key changed, and a second if the result is within 5 points of 80%
- [ ] The report states pass or fail against the bar, with per-kind numbers next to tickets 26 and 37, and the blind-set recall
- [ ] On a fail, the worst questions and their causes are in the handover
- [ ] Status moves to `ready-for-human`
