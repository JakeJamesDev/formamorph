# 03: Thought Ceiling on the wire

Status: ready-for-human
Base: 609ce03e
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Rationale: changes the request cap for every no-budget reasoning target, and the context reserve must not follow it.

Parent: [Answer Cap and Reasoning Room spec](../spec.md)

## What to build

With reasoning on and a target that takes no budget, the request's `max_tokens` becomes the Thought Ceiling: the Answer Cap plus 200% of the endpoint's Max Output. A budget-taking target keeps the Answer Cap plus its budget. Reasoning off keeps the Answer Cap. The context reserve and the length guidance keep reading the Answer Cap plus the budget at the prompt's own percent, so the history room does not change. The **Max Output Tokens** and per-prompt **Max Output** help lines say that they cap the answer, not reasoning.

## Acceptance criteria

- [x] Request-body tests: no-budget target with reasoning on sends the Thought Ceiling; budget-taking target sends the Answer Cap plus the budget; reasoning off sends the Answer Cap.
- [x] Output-caps tests show the reserve uses the prompt's own percent, not the ceiling.
- [x] The AI Context viewer shows the sent `max_tokens`.
- [x] Help-line copy updated and passes the copy tests.
- [ ] Live check: rerun the LM Studio cap-only arm and record the finish reasons and answer lengths here. Open: LM Studio was not running at build time, and the MeroMero arm needs an agreed window.
- [x] Changelog line in 🚧 In Progress.
- [x] Four gates green.

## Rulings from the spec session

- Q-A: with no endpoint Max Output, the Answer Cap is the base, so the ceiling is the Answer Cap × 3.
- Q-B: the AI Context viewer shows a separate **Max Tokens** chip beside the reasoning chip.
- Q-C: the rule is "no budget on the wire → Thought Ceiling", so a budget-taking target with no base gets it too.
- R1, R3: Inline narration sends the ceiling on any endpoint. This also covers an endpoint that refuses off, since only Inline narration resolves to `none` there.
- R2: an unprobed endpoint that is sent no reasoning field keeps the Answer Cap.
