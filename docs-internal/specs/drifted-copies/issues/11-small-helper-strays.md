# 11: Small Helper Strays

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: three tiny swaps onto helpers that already exist.

## What to build

Three call groups move onto the helper that already exists. A failed share-code copy shows a failure toast, and the local-model copy label resets. Every ID comes from the UUID helper. Community sort reads bare server timestamps as UTC.

Spec: Implementation Decisions: Clipboard, IDs, Timestamps; Q3. Stories 20, 22, 23.

## Acceptance criteria

- [ ] A regression test: a rejected share-code copy shows a failure toast and leaves no unhandled rejection
- [ ] A regression test: a bare timestamp sorts as UTC, and it fails with the old parse put back
- [ ] No direct `crypto.randomUUID()` call remains outside the UUID helper
- [ ] Four gates green

## Blocked by

- None (can start immediately)
