# 03: llama.cpp Dialect

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a new dialect row, a capability-source change, and a budget that sizes by strength with no slider, which the record has no flag for yet.

## What to build

llama.cpp gets its own dialect row. The `/props` capability source names it. The row sends the Thinking Room as `reasoning_budget_tokens`, so the server ends the thought at the room and the model writes its answer. A switched-off prompt sends `reasoning_effort: "none"` on every template; other levels go out only where `/props` reports `supports_reasoning_effort`. The record marks the budget as sized by strength, so the request sends the room and the budget slider stays hidden. A llama.cpp reply whose reasoning ran past the room adds a debug-log line; nothing shows to the player. `reasoning_control` and `reasoning_end` are not used. Changelog fragment for the llama.cpp fix.

Spec: Q5, Q6, Q12, Q14; stories 3, 4, 14, 23, 27, 28. Research: `docs-internal/notes/multi-endpoint-reasoning/providers.md`, llama.cpp section.

## Wire facts

Read from llama.cpp master source on 2026-10-14 (the server's common request parser); the field is not in the README.

- The server reads `reasoning_budget_tokens` and falls back to `thinking_budget_tokens`. The `unknown` row already writes `thinking_budget_tokens`, so the field works today; it never goes out only because the llama.cpp record answers `budget: null`. The new row may keep either spelling.
- `-1` means "use the server's `--reasoning-budget`". Never send it.
- The budget applies only when the loaded template has thinking end tags. On other templates the server ignores it silently.
- At the budget the server injects `reasoning_budget_message` (none by default) before the end tag, then the model answers.
- Builds from 2026-04-14 on have the per-request budget. Older builds ignore it (Q14).
- `reasoning_effort: "none"` disables thinking on any template.

## Acceptance criteria

- [ ] Director at Low on llama.cpp sends `reasoning_budget_tokens` 1,024 and `max_tokens` = Answer Cap + 1,024
- [ ] A switched-off prompt sends `reasoning_effort: "none"` on a template without effort support, and no budget field
- [ ] Levels other than none still follow `/props`; a build with no template caps keeps today's record
- [ ] The prompt's reasoning field shows no budget slider for a llama.cpp target
- [ ] A reply whose reasoning exceeds the room writes one debug-log line
- [ ] Records cached before the change pick up the new dialect without a manual refresh
- [ ] Four gates green
