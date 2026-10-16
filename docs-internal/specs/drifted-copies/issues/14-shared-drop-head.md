# 14: Shared Drop Head

Status: done
Blocked by: 13
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: four drop paths with real per-tree commit steps.

## What to build

One drop planner covers the shared start of a drop: remove collapsed rows, guard visibility, project, guard cycles, move. Group, location, placeholder and scoped placeholder drops keep only their own commit step.

Spec: Implementation Decisions: Tree drag-drop merge. Story 27.

## Acceptance criteria

- [ ] The planner has behavior tests including a refused cycle
- [ ] Existing drop tests for all four trees pass with no assertion edits
- [ ] Four gates green

## Blocked by

- 13
