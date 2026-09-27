# 03: Image provider errors carry status and body

Status: ready-for-human
Base: 476f427e
Blocked by: 01 — Details field and headline
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

When InvokeAI, Automatic1111 or OpenAI images refuse a request, the error toast keeps its short message and **View Details →** shows the HTTP status and the provider's response body, as the ComfyUI rejection does today. The player sees which setting the provider refused.

Each provider puts the details on the error it already throws. The InvokeAI HTTP error keeps its class and gains `details`. Endpoint URLs in details go through the shared redaction helper.

Recommended model rationale: three parallel, well-bounded changes with a shipped reference implementation; strong coding, moderate design.

## Acceptance criteria

- [x] Each of the three providers, given a stubbed non-OK response, throws an error whose `details` names the status and the body
- [x] The InvokeAI HTTP error is still an instance of its class
- [x] The generate-image toast for each provider offers **View Details →** and the window shows the body
- [x] A provider endpoint with a key in its query string is masked in the details
- [x] Mutation check: dropping the body from any provider's details fails its test
- [x] Four gates green
