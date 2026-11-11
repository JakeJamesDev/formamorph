# 05: Openings Reveals on Outside Navigation

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one list reads the reveal request ticket 01 built, as the other trees already do.

## What to build

The close review found that the Openings tab breaks Q20. Find and Reveal Origin already send a reveal request to the Openings tab, but its owner list never reads it. An owner inside a collapsed group stays hidden after the jump.

- An outside navigation to an owner opens every collapsed group above it, even when that owner is already selected (Q20).
- Remounting the tab with the same selection keeps its groups closed (Q17).
- Use the per-tab reveal state ticket 01 put in the store; do not add a second mechanism.
- No changelog entry: the Openings collapse is still unreleased.

## Acceptance criteria

- [ ] Collapse All on Openings, then Find an owner inside a collapsed group: the owner row shows (editor-bench test, mutation-tested: dropping the reveal turns it red)
- [ ] The same jump to the already-selected owner also reveals it (editor-bench test)
- [ ] Switching tabs and back with the same selection keeps the groups collapsed (editor-bench test)
