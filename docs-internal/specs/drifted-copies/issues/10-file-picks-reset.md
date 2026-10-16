# 10: File Picks Reset

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: mechanical picker swaps and one shared import routine.

## What to build

Every file input reads through the shared picker helper, which resets the input. **Load World** accepts the same file twice. The stat-code template import and the tools import share one routine.

Spec: Implementation Decisions: File picks. Stories 18, 19, 34.

## Acceptance criteria

- [ ] A regression test picks the same world file twice and both loads run, and it fails with the old code put back
- [ ] Every picker named in the spec uses the helper
- [ ] Template and tools import share one routine with one reset
- [ ] Four gates green

## Blocked by

- None (can start immediately)
