# 19: Retire The Twins

Status: done
Blocked by: 17, 18
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the contract step; removes the old engine.

## What to build

The contract step. Placeable group ids, Blueprints subtree ids, links in tree order, owner choices and the owned-list writers fold into the engine. The old trait and stat drop code is deleted.

Spec: Implementation Decisions: Owner-tree engine merge.

## Acceptance criteria

- [ ] No caller of the old twins remains
- [ ] The parity harness passes
- [ ] Existing tests pass with no assertion edits
- [ ] Four gates green

## Blocked by

- 17
- 18
