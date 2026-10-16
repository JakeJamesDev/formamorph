# 01: Shared Ancestor Walk

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one small pure helper and mechanical call-site swaps.

## What to build

One generic ancestor walk with a seen-set. **Arrange** on the location canvas finishes on a world whose locations hold each other in a loop. The group and location descendant checks and every other path-to-root walk (placeholders, Blueprints, location search, stat-code paths) use the shared walk.

Spec: Implementation Decisions: Ancestor walk. Stories 7, 29.

## Acceptance criteria

- [ ] `ancestors` has behavior tests: a plain chain, a dangling parent, a cycle
- [ ] A regression test runs Arrange on a cyclic world and it returns, and it fails with the old depth count put back
- [ ] Every path-to-root walk named in the spec uses the helper
- [ ] Existing tree and location tests pass unchanged
- [ ] Four gates green

## Blocked by

- None (can start immediately)
