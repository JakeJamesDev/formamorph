# 02: Client-side Answer Cap

Status: ready-for-human
Base: 59fe15e9
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Rationale: stream abort, trim, and finish-reason semantics inside the tool loop, plus the Inline mode think-block edge; a wrong finish reason reads as a player cancel.

Parent: [Answer Cap and Reasoning Room spec](../spec.md)

## What to build

The AI Request Spec carries the Answer Cap as its own plain value. The tool loop counts answer text with the app's existing token estimate; reasoning events do not count. When the count passes the Answer Cap, the loop aborts the request and trims the answer to its last sentence end (or keeps the cut text when it has none). The result finishes with `length`, never `aborted`. Events that arrive in one chunk give the same trimmed text. On the Inline-mode narration call, the count starts after the model's `<think>` block closes.

The wire `max_tokens` does not change in this ticket, so the client cap and the server cap agree.

## Acceptance criteria

- [x] Tool-loop tests over a fake SSE fetch: answer events past the cap abort, trim to the last sentence end, and finish with `length`.
- [x] Reasoning events of any length do not count toward the cap.
- [x] All events in one chunk give the same trimmed text.
- [x] Inline mode: the `<think>` block does not count.
- [x] A player cancel still finishes with `aborted`.
- [x] Each guard test fails when its bug is put back.
- [x] Changelog line in 🚧 In Progress.
- [x] Four gates green.
