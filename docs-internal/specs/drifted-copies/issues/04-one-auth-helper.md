# 04: One Auth Helper For Services

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a helper move plus many mechanical service edits.

## What to build

One shared auth header and response helper for every service. Signed out, no request carries an auth header. Every service shows the server's error text through the same path, including the world storage sites that drop it today.

Spec: Implementation Decisions: Auth requests. Stories 8, 11, 30.

## Acceptance criteria

- [ ] The helpers have behavior tests: signed in, signed out, error body, non-JSON error body
- [ ] A regression test shows a signed-out request from a service that sent `Bearer null` carries no header, and it fails with the old code put back
- [ ] Feedback, message, audit, event, user, age gate and Patreon services and the hand-built world storage sites use the helpers
- [ ] Four gates green

## Blocked by

- None (can start immediately)
