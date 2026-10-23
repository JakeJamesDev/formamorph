# 07: Context Overflow

Status: done
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

- [x] Proxy tests through the fake server, for each policy: a prompt that fits passes unchanged; an overflowing prompt is cut on message boundaries only; Truncate Middle keeps the system prompt and the first user message. `llmEngine.test.mjs` › Context Overflow (13 tests: also the half-slot reserve cap, the client hangup mid-count, and the server's own context error restated); 12 engine mutants each fail a test.
- [x] Stop at Limit returns a stop the app shows as a context-length stop. HTTP 400 `exceed_context_size_error` with the message in the panel's names, the shape llama-server's own overflow error has; test "Stop at Limit returns a context-length stop…".
- [x] The cut prompt fits the slot's context by the server's token count. Fake-count assertions in the tests, and a real run (Qwen3 4B, 1,024 context, max 120): Truncate Middle sent 839 prompt tokens, Rolling Window 703, by `usage.prompt_tokens`; our uncut count, 2,963, matched llama-server's own.
- [x] Panel tests: the row shows in Advanced, defaults to Truncate Middle, and Reset restores it. `LocalModelPanel.test.tsx` › Context Overflow row, plus a test that a change reaches the engine at once with no reload (T07-5).
- [x] `copy-sweep` passes on the new row. No notices on the row; the Engine hint lost its period. The stop messages (`.cjs`, outside the script) were checked by hand.
- [x] Changelog fragment in `docs-internal/changelog.d/`.

For you: play a long story past the context and check the narrator still knows the world and your first message.

## Landed

**Not verified**
- None of the criteria. A cut prompt was not played in the app; the real-binary run drove the engine module directly.
- The count reads the template text only, so image embeddings are not counted (ticket 08). The server's own context error then comes back in the same wording as the proxy's stop.

**For you**
- For you: play a long story past the context and check the narrator still knows the world and your first message.
- Set **Context Overflow** to **Stop at Limit** with a small **Context Size** and read how the error shows in play.
