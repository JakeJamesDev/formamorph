# 18: Shared Portable Links

Status: done
Blocked by: 17
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a shared link layer plus one deliberate behavior fix.

## What to build

One portable and bound-link implementation for traits and stats. Both deduplicate links in tree order, so binding owned stats keeps the same link that play keeps.

Spec: Implementation Decisions: Owner-tree engine merge. Story 26.

## Acceptance criteria

- [ ] A regression test binds two overlapping stat links and keeps the tree-order one, and it fails with the old code put back
- [ ] The parity harness passes, with the stat bind case updated only for this fix
- [ ] Four gates green

## Blocked by

- 17
