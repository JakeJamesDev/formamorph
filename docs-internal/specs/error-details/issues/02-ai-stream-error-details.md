# 02: AI stream errors carry the server's reason

Status: ready-for-human
Base: e92ea5ef
Blocked by: 01 — Details field and headline
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

When an AI request fails with an HTTP error, the in-game "Failed to process AI request" toast keeps its words and its **View Details →** link shows the status, the server's message, param, type and code, and the raw response body. A player can read "model not found" or "context length exceeded" without asking anyone.

The stream error keeps its class, its kind, its status and its structured server error, because the rejected-endpoint-override code checks all three. It gains a `details` field. The stream reads the body once as text, keeps the raw string and parses the structured fields from it.

A shared redaction helper masks keys, tokens and passwords in a URL's query string before the URL enters any details text. Request headers never enter details.

Recommended model rationale: the stream is the app's hottest path and the override detection depends on its error shape; a wrong change breaks every turn.

## Acceptance criteria

- [x] An HTTP failure from a stubbed fetch throws the stream error with `details` naming the status, the server's message, param, type, code and the raw body
- [x] The thrown error is still an instance of its class with its `kind`, so rejected-override detection still returns its notice
- [x] The in-game toast on that failure shows **View Details →**, and the window contains the server's message
- [x] A URL with a key in its query string appears masked in the details; a URL without one is unchanged
- [x] Details contain no request headers
- [x] Mutation checks: skipping redaction and dropping the raw body each fail a test
- [x] Four gates green
