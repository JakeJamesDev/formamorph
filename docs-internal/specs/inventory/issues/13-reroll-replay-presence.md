# 13: Re-Roll Replay Reads This Turn's Presence

Status: needs-triage
Blocked by: 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Gap found by the spec close review.

## What to build

The stats-only re-roll replays the stored Inventory pass operations with no discoveries and no moved positions. The live commit passes both. An operation aimed at an entity that arrived or was discovered this turn can skip on the re-roll.

Spec: Q62, Q142.

## Acceptance criteria

- [ ] A re-roll replays a give to an entity discovered this turn and lands it, as the live turn did
- [ ] A re-roll replays a give to an entity that moved in this turn and lands it
- [ ] A test covers each; removing the presence inputs from the replay fails them

## Blocked by

- 09
