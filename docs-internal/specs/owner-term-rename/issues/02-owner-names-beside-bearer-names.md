# 02: Owner Names Beside Bearer Names

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: mechanical expand step with no behavior change.

## What to build

The expand step of the wide refactor. Every exported type, function, component and file name that says bearer or holder in the sense of owner gets an owner name. The old names stay as aliases that point at the new ones, so no call site breaks. The in-memory player key, now named for the world, gets a player name (Q2).

Leave alone: HTTP `Authorization: Bearer`, the `holderOf` functions in the location and placeholder trees, and the placeholder `ownerId` key (Q7).

Spec: Q6.

## Acceptance criteria

- [ ] Each owner-sense bearer/holder export has an owner-named twin, and the old name is an alias
- [ ] Moved files keep a re-export at the old path
- [ ] No behavior change; four gates green

## Blocked by

- None (can start immediately)
