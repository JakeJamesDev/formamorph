# 53: Help baseline against the bar, third run

Status: ready-for-agent
Blocked by: 50, 51, 52
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The user learns whether Formaquestion meets the 80% bar (Q59, kept in Q79). Run ticket 46's measurement again on the build with tickets 50, 51 and 52.

- Default cloud model, ticket 26's 125 questions, both arms, 5 runs, the same keys as ticket 46. Change no key.
- The bar: 80% grounded-correct over the English task, "here" and follow-up questions together. Report each kind next to tickets 26, 37 and 46.
- Report ticket 39's blind-set recall and task recall over the three open screens, as ticket 46 did.
- A result inside 5 points of the bar gets a second batch before any verdict.
- Under the bar: list the worst questions with causes and hand them to the spec session. Do not tune the prompt here.

Recommended model rationale: the verdict decides whether the effort closes.

## Acceptance criteria

- [ ] One full batch with no key changed, and a second if the result is within 5 points of 80%
- [ ] The report states pass or fail against the bar, with per-kind numbers next to tickets 26, 37 and 46, the blind-set recall and the open-screen recall
- [ ] On a fail, the worst questions and their causes are in the handover
- [ ] Status moves to `ready-for-human`
