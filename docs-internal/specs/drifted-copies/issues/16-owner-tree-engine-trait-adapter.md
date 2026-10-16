# 16: Owner-Tree Engine, Trait Adapter

Status: done
Blocked by: 02, 15
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the expand step of the largest merge.

## What to build

The generic owner-tree drop engine with an owner adapter. Owned traits run on it. The stat tree is unchanged. Trait drops give the same output as before.

Spec: Implementation Decisions: Owner-tree engine merge. Stories 24, 25.

## Acceptance criteria

- [ ] The engine has behavior tests through the trait adapter
- [ ] The parity harness passes for traits
- [ ] Existing trait tree tests pass with no assertion edits
- [ ] Four gates green

## Blocked by

- 02
- 15
