# 12: One IndexedDB Connection

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one helper and eight cache swaps.

## What to build

One cached IndexedDB connection that resets after a failed open, and one count-gated LRU prune. A failed open of the stat-template store retries on the next use. Every cache named in the spec uses the helper.

Spec: Implementation Decisions: IndexedDB connection. Stories 21, 31.

## Acceptance criteria

- [ ] The connection helper has behavior tests: success, failure then retry
- [ ] The prune helper has behavior tests at and over the cap
- [ ] A regression test fails the first stat-template open and the next call succeeds, and it fails with the old code put back
- [ ] The listing details cache uses the shared transaction helper
- [ ] Four gates green

## Blocked by

- None (can start immediately)
