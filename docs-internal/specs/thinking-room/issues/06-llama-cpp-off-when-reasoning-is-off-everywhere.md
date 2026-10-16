# 06: llama.cpp Off When Reasoning Is Off Everywhere

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: it narrows the shared "engaged nowhere" gate for one dialect without letting a field reach plain endpoints.

## What to build

When reasoning is engaged nowhere (every prompt off and Thinking off), a llama.cpp target still sends `reasoning_effort: "none"` on every call, as Q5 says. Today the shared eligibility gate blocks every dialect's off signal in that state, so a llama.cpp body carries `reasoning_budget_tokens: 0` and no `none`. The llama.cpp off is `none` alone, with no budget field beside it. Plain endpoints and every other dialect keep today's bodies in that state: no reasoning field at all where none goes out today.

Spec: Q5, Q17.

## Acceptance criteria

- [ ] With every prompt off and Thinking off, a llama.cpp call sends `reasoning_effort: "none"` and no budget field, on a template with and without effort support
- [ ] With one prompt on, a switched-off llama.cpp prompt still sends `none` alone
- [ ] An unknown endpoint and every other dialect send byte-equal bodies to today's when reasoning is engaged nowhere
- [ ] The guard fails with the shared gate restored for llama.cpp
- [ ] Four gates green
