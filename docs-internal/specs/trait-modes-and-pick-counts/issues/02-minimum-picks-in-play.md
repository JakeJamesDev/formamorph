# 02: Minimum picks in play

Status: ready-for-human
Base: 826df3ed
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: refusal rules inside the settle/switch path interact with cascade-off and returns; the edge cases need care.

Parent: [Trait Modes and Pick Counts spec](../spec.md)

## What to build

A group's minimum is enforced. On the setup screen, a group short of its minimum shows how many more picks it needs, and Begin is disabled until every group meets its minimum. Quick Start never blocks and starts with the gap left in place (Q9). Mid-game, the player can't switch off a trait when that drops its group below the minimum (Q6). A gate failure may still drop a group below its minimum. There is no prompt, and the group fills again when the trait returns (Q7).

## Acceptance criteria

- [x] The gate module refuses a switch-off that drops a group below `minPicks`, for every bearer.
- [x] Settle never refuses a cascade-off because of a minimum. A short group after a cascade is a valid state, and the Q34 return still fills it.
- [x] The setup list shows a short group's needed count. Begin is disabled while any group on any bearer is short.
- [x] Quick Start starts with no minimum check.
- [x] The Traits tab disables the switch on a trait whose switch-off would be refused.
- [x] Tests: the switch-off refusal; the short group after a cascade and its return; Begin disabled and enabled; Quick Start starting while short. Each guard is shown to bite.
- [x] The changelog line is in In Progress.
