# 37: Help baseline against the bar

Status: ready-for-agent
Blocked by: 32, 34, 35, 36
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The user learns whether Formaquestion meets the 80% bar (Q59). Run ticket 26's full harness on the build with tickets 32, 34, 35 and 36.

- Default cloud model, 125 questions, both arms, 5 runs, the same keys as ticket 26. Change no key.
- The bar: 80% grounded-correct over the English task, "here" and follow-up questions together. Report each kind too.
- A result inside 5 points of the bar gets a second batch before any verdict, because batches drift by about that much.
- Under the bar: list the worst questions with causes, as ticket 26 did, and hand them to the spec session for follow-up tickets. Do not tune the prompt here.
- Questions in another language stay out of the bar (Q61).

Recommended model rationale: the verdict and the cause list decide what comes next.

## Acceptance criteria

- [ ] One full batch on the default cloud model with no key changed, and a second batch if the result is within 5 points of 80%
- [ ] The report states pass or fail against the bar, with per-kind numbers next to ticket 26's
- [ ] On a fail, the worst questions and their causes are in the handover
- [ ] Status moves to `ready-for-human`
