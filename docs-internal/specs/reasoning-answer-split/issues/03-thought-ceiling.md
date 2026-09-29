# 03: Thought Ceiling on the wire

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Rationale: changes the request cap for every no-budget reasoning target, and the context reserve must not follow it.

Parent: [Answer Cap and Reasoning Room spec](../spec.md)

## What to build

With reasoning on and a target that takes no budget, the request's `max_tokens` becomes the Thought Ceiling: the Answer Cap plus 200% of the endpoint's Max Output. A budget-taking target keeps the Answer Cap plus its budget. Reasoning off keeps the Answer Cap. The context reserve and the length guidance keep reading the Answer Cap plus the budget at the prompt's own percent, so the history room does not change. The **Max Output Tokens** and per-prompt **Max Output** help lines say that they cap the answer, not reasoning.

## Acceptance criteria

- [ ] Request-body tests: no-budget target with reasoning on sends the Thought Ceiling; budget-taking target sends the Answer Cap plus the budget; reasoning off sends the Answer Cap.
- [ ] Output-caps tests show the reserve uses the prompt's own percent, not the ceiling.
- [ ] The AI Context viewer shows the sent `max_tokens`.
- [ ] Help-line copy updated and passes the copy tests.
- [ ] Live check: rerun the LM Studio cap-only arm and record the finish reasons and answer lengths here.
- [ ] Changelog line in 🚧 In Progress.
- [ ] Four gates green.
