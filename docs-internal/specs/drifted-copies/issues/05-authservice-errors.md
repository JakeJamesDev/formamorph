# 05: AuthService Errors

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: contained error-path edits in one service.

## What to build

Every AuthService failure goes through the shared error reader with its own fallback. Login shows the server's reason for a refusal. A login or password change that gets an error page shows its fallback text, not a parse error.

Spec: Implementation Decisions: AuthService errors. Stories 9, 10.

## Acceptance criteria

- [ ] A regression test: login refused with an `error` field shows that text, and it fails with the old code put back
- [ ] A regression test: login answered by an HTML 502 shows "Login failed"
- [ ] Every AuthService failure path uses the shared reader
- [ ] Four gates green

## Blocked by

- None (can start immediately)
