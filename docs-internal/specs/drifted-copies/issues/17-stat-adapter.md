# 17: Stat Adapter

Status: done
Blocked by: 16
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: real divergences must survive as adapter choices.

## What to build

Owned stats run on the engine through their own adapter. Row id prefixes, cross-owner checks and the refusal with link creation off stay. The three "rows below an id" implementations become one.

Spec: Implementation Decisions: Owner-tree engine merge. Stories 24, 25.

## Acceptance criteria

- [ ] The parity harness passes for stats
- [ ] Existing owned stat tree tests pass with no assertion edits
- [ ] One "rows below" implementation remains
- [ ] Four gates green

## Blocked by

- 16

## Comments

- 2026-10-15, from ticket 16: the owner-tree engine is built for raw row ids. The stat adapter needs two engine hooks: an id hook on the source (stat `entity/id` prefixes in the entity write, world write and drop result) and a world-write hook on the rules (the tree-order stat step and the row-id slot). These already fit: links-off returns null through `check` (Q6), and cross-owner checks receive the subtree, source owner, target owner and the tree. The stat source must fill `linkRows` for linked rows, because the projection blocks on it.
