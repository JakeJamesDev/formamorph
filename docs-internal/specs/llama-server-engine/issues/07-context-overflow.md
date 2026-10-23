# 07: Context Overflow

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: message-level truncation against real token counts, with edge cases at the system prompt and the first message.

## What to build

A **Context Overflow** setting in the Local Model panel under **Advanced**, with LM Studio's three policies (spec: Context Overflow; Q23):

- **Truncate Middle** (default): keep the system prompt and the first user message, and drop messages from the middle until the prompt fits.
- **Rolling Window**: drop the oldest messages first.
- **Stop at Limit**: return a context-length stop that the app can show.

The proxy applies the policy to whole messages before the prompt reaches `llama-server`. Token counts come from the server's tokenizer, so the cut matches what the model sees. The setting reaches the proxy through the engine-setting path.

## Acceptance criteria

- [ ] Proxy tests through the fake server, for each policy: a prompt that fits passes unchanged; an overflowing prompt is cut on message boundaries only; Truncate Middle keeps the system prompt and the first user message.
- [ ] Stop at Limit returns a stop the app shows as a context-length stop.
- [ ] The cut prompt fits the slot's context by the server's token count.
- [ ] Panel tests: the row shows in Advanced, defaults to Truncate Middle, and Reset restores it.
- [ ] `copy-sweep` passes on the new row.
- [ ] Changelog fragment in `docs-internal/changelog.d/`.

For you: play a long story past the context and check the narrator still knows the world and your first message.
