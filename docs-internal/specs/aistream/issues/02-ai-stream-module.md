# 02 — AI Stream module

**What to build:** The AI Stream: an async iterator that takes an AI Request Spec, performs the streaming request, and yields typed events `delta | reasoning | debug | done`. `done` carries `{ content, reasoningText, finishReason, timings }`. The 80 ms reasoning throttle lives inside; abort ends gracefully with partial content and `finishReason: 'aborted'`; failures throw a typed `AiStreamError` (`http | no-body | parse`). Still unconsumed by the app. See [../spec.md](../spec.md).

**Blocked by:** 01 — AI Request Spec module.

Status: ready-for-human

- [x] Mocked-fetch SSE tests: events split across chunk boundaries, `reasoning`/`reasoning_content` accumulation, `finish_reason`, malformed JSON line, HTTP error, missing body
- [x] Abort mid-stream yields graceful `done` with the partial content already streamed
- [x] Throttle verified with fake timers
- [x] `debug` events expose the built body and timings without any UI knowledge in the module
- [x] No React imports; four gates green
