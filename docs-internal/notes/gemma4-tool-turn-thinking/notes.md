# Gemma 4 thinks after a tool result

▶ Resume here: the template fix below is not built anywhere. The cloud endpoint is not ours, but its operator may change it.

## The bug

With thinking off, Gemma 4's chat template (12B / 26B / 31B) opens a fresh model turn with an empty thought block, `<|channel>thought\n<channel|>`. After a tool response it adds nothing, so the model often thinks anyway, even with `reasoning_effort: "none"`.

| Measured on the cloud default (2026-10-31) | Thought-led round 2 |
|---|---|
| Formaquestion Create, after a `set_face` result | 59 / 62 |
| Sedge Landing narration, after a `get_entity` result | 9–11 / 20 |
| The same narration with no tool exchange | 0 / 20 |

- Create: the thought ate the 800-token cap in 15–24% of replies (empty or cut-off drafts).
- Narration: no cut-offs at 1,024 tokens. The cost is about 60–100 extra tokens and the wait.

## What is fixed

- `50ec9d4d1`: the tool loop's `unseen` set. Help passes the face call: it runs, then later rounds drop the call, its result and the function. Create on the cloud: 1 empty of 56, down from 10 of 55.
- That fix only covers calls whose result the model never needs. Lookups and Tools still hit the bug.

## The standard fix (not built)

Fix it in the chat template or the server: after a `tool_response`, write the empty thought block when thinking is off.

- **Cloud endpoint (`api.lyonade.net`):** not ours. Its operator can apply the template fix. It runs Aphrodite (a vLLM fork).
- **Desktop engine (bundled llama-server):** ours. Ship a patched Gemma 4 template (`--chat-template-file`).
- **LM Studio / Ollama:** the player's server. Ollama has an open fix (below).

## Ruled out

| Approach | Result |
|---|---|
| Prefill `<\|channel>thought\n<channel\|>` with `continue_final_message` | HTTP 400: the template strips thought blocks from assistant messages |
| Prefill `" "` | Worse: 16 / 20 thought-led |
| `chat_template_kwargs.enable_thinking: false` | Worse: 4 / 5 in a smoke run |
| `tool_choice: "none"` to block a repeat face call | Gemma writes the call as plain text |
| Call limit of 1 | The first result stays in context |
| Tool result as text in the user message | 0 / 20 thought-led, but a known workaround with role-confusion risks, and against Google's own format. Not adopted. |

## Sources

- [ollama/ollama#18861](https://github.com/ollama/ollama/issues/18861): empty reply after a tool response. Open; PR #18862 writes the empty block in the renderer.
- [ai-dynamo/dynamo#16781](https://github.com/ai-dynamo/dynamo/issues/16781): empty block leaks into content after a tool result. Closed by PR #17486.
- [gemma-4-31B-it discussion 115](https://huggingface.co/google/gemma-4-31B-it/discussions/115): multi-round tool calling in the template. Google says a fix is in progress.
- [Gemma thinking docs](https://ai.google.dev/gemma/docs/capabilities/thinking) · [Gemma 4 prompt formatting](https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4)

## Probes

- `testing/baseline/harness/help-create-probe.cli.ts`: the `fn` arm offers `set_face`. `PROBE_ROUNDS=FILE` logs every round.
- `.scratch/tool-prefill-probe.ts` (untracked): narration round 2 after a real `get_entity` result, with the arms above.
