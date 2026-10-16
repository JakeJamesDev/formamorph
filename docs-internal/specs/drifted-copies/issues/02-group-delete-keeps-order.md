# 02: Group Delete Keeps Order

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one operation adopted from the stat group tree, five call sites.

## What to build

One promote-children operation for every group tree. Deleting an entity, trait, owned, placeholder or location group puts its children in the group's slot and renumbers sibling order, the way stat groups already do.

Spec: Implementation Decisions: Group delete. Stories 1-4.

## Acceptance criteria

- [ ] The operation has behavior tests for first, middle and last slots and nested children
- [ ] A regression test deletes an entity group through the game data actions and checks sibling order, and it fails with the old code put back
- [ ] Trait, owned, placeholder and location group deletes use the operation
- [ ] Four gates green

## Blocked by

- None (can start immediately)
