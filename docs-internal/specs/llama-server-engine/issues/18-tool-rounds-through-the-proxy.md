# 18: Tool Rounds Through the Proxy

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the proxy's message rules meet multi-round tool calls, and the ruled old-engine behavior must still hold for plain chats.

## What to build

World Tools work through the desktop engine (spec: Proxy; ruling T18). Today the proxy rebuilds every message as `{role, content}` only, so a tool round loses the assistant's `tool_calls`, every `tool` message, and the `reasoning_content` the tool loop echoes back. Its last-message rule also turns a trailing `tool` message into a user turn. The model never sees its tool results.

The engine already advertises tool support: the capability probe sends `tools` and llama-server accepts them, so the app runs its tool loop against the engine today.

A conversation with tool turns keeps its `tool_calls`, `tool` messages and `reasoning_content`, in order, and a trailing `tool` message stays a `tool` message. A conversation without tool turns keeps T03-1 and T03-2 exactly as they are.

## Acceptance criteria

- [ ] Proxy tests through the fake server: an assistant `tool_calls` turn, its `tool` replies and the echoed `reasoning_content` reach llama-server unchanged; a trailing `tool` message stays a `tool` message.
- [ ] The existing T03-1 and T03-2 tests still pass unchanged for chats without tool turns.
- [ ] The guard is proven to bite: with the old message rebuild back, the new tests fail.
- [ ] On this PC, a World Tool round runs end to end through the engine: the model calls a tool, gets its result, and answers using it.
- [ ] Changelog fragment in `docs-internal/changelog.d/`.

For you: play a world with a World Tool on the local engine and check the narrator uses the tool's result.

Local GPU use: check nothing else is loaded first, keep each load short, and stop the server after.
