# 18: Tool Rounds Through the Proxy

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the proxy's message rules meet multi-round tool calls, and the ruled old-engine behavior must still hold for plain chats.

## What to build

World Tools work through the desktop engine (spec: Proxy; ruling T18). Today the proxy rebuilds every message as `{role, content}` only, so a tool round loses the assistant's `tool_calls`, every `tool` message, and the `reasoning_content` the tool loop echoes back. Its last-message rule also turns a trailing `tool` message into a user turn. The model never sees its tool results.

The engine already advertises tool support: the capability probe sends `tools` and llama-server accepts them, so the app runs its tool loop against the engine today.

A conversation with tool turns keeps its `tool_calls`, `tool` messages and `reasoning_content`, in order, and a trailing `tool` message stays a `tool` message. A conversation without tool turns keeps T03-1 and T03-2 exactly as they are.

## Acceptance criteria

- [x] Proxy tests through the fake server: an assistant `tool_calls` turn, its `tool` replies and the echoed `reasoning_content` reach llama-server unchanged; a trailing `tool` message stays a `tool` message. `llmEngine.test.mjs` › "sends every tool round unchanged…" and "keeps the other message rules in a tool conversation".
- [x] The existing T03-1 and T03-2 tests still pass unchanged for chats without tool turns. No existing test was edited; 80/80 pass.
- [x] The guard is proven to bite: with the old message rebuild back, the new tests fail. Shape rule off: 4 tool tests red. Overflow tool filter off: the two round-unit tests red. Cut past the last user turn: the current-round test red.
- [x] On this PC, a World Tool round runs end to end through the engine: the model calls a tool, gets its result, and answers using it. Gemma 4 12B through the real engine proxy (scratch script); see Landed.
- [x] Changelog fragment in `docs-internal/changelog.d/`.

For you: play a world with a World Tool on the local engine and check the narrator uses the tool's result.

Local GPU use: check nothing else is loaded first, keep each load short, and stop the server after.

## Landed

**Shown on this PC (RTX 4090, Vulkan)**
- GPU idle and nothing loaded in LM Studio first. A scratch script started the real engine (`createEngine`, pinned build) and sent a tool round through its proxy port, `temperature: 0`.
- Impish 4B answered in prose and called no tool: a roleplay finetune, not a proxy fault.
- Gemma 4 12B (unsloth QAT Q4_K_XL): round 1 called `read_vault_code`; round 2 sent the assistant `tool_calls` turn and a trailing `tool` message with the code, and the reply used it ("The numbers are clear: **4127**"). Load to stop: 23 s. No `llama-server` process left after.
- Context Overflow (ruled in the intent answers): the cut never passes the last user turn and never ends on a `tool` message, so an older round drops as a unit and the current round stays whole or gives the context stop. Tested under Truncate Middle and Rolling Window.

**Not verified**
- The real server's handling of an echoed `reasoning_content`: the engine still ran `--reasoning-format none` (ticket 17 not landed), so Gemma's thought arrived in `content` and was echoed there. The fake-server test covers the field passing through.
- The app's own tool loop with a World Tool on the engine: the run used a scratch script, not a world.
- V8 coverage lists `chatShape.cjs` lines 41–47 as missed, yet the mutation runs show the new tests execute them; the report undercounts the `require`d CJS path.

**For you**
- Play a world with a World Tool on the local engine and check the narrator uses the tool's result.
