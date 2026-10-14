# 01: Global Slot Beside Owners

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the expand step of a wide refactor; the shape every later ticket builds on.

## What to build

The expand step. Owner-keyed state gains a global part beside an owners map keyed by entity id (Q2, R0). The new shape and its readers sit beside the stand-in player key, so every existing caller keeps working. The played entity is reached through its own id. Nothing a player or author sees changes.

Spec: R0, Q2, stories 26–28.

## Acceptance criteria

- [ ] Gate input, trait force state and stat owner state each offer the global/owners shape beside the old key
- [ ] The played entity resolves through its own entity id from the new shape
- [ ] Every existing suite passes with no expected value changed
- [ ] Four gates green

## Blocked by

- None (can start immediately)
