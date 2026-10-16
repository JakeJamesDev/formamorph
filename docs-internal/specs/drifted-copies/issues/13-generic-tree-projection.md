# 13: Generic Tree Projection

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: behavior-preserving merge across three tree modules.

## What to build

One drag projection with a `canParent` parameter, one collapsed-row removal and one dangling-parent helper. The group, location and placeholder trees use them. Dragging behaves exactly as before.

Spec: Implementation Decisions: Tree drag-drop merge. Stories 27, 28.

## Acceptance criteria

- [ ] The projection has behavior tests for both `canParent` rules
- [ ] Existing group, location and placeholder tree tests pass with no assertion edits
- [ ] The three old projections and removals are gone
- [ ] Four gates green

## Blocked by

- 01
- 02
