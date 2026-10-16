# 03: Duplicate After With Fresh Rolls

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a small list helper and three call sites.

## What to build

One duplicate-after operation that inserts the copy right after the source. **Duplicate** on a location gives the copy fresh Unique-chip rolls from the tree and from the filtered list. Dictionary entries use the same operation.

Spec: Implementation Decisions: Duplicate after. Stories 5, 6.

## Acceptance criteria

- [ ] The operation has behavior tests
- [ ] A regression test duplicates a location through the list adapter and checks that the copy's placeholder values are reminted, and it fails with the old code put back
- [ ] Location tree, location list and dictionary duplicates use the operation
- [ ] Four gates green

## Blocked by

- None (can start immediately)
