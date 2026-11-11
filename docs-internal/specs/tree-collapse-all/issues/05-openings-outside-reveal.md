# 05: Openings Reveals on Outside Navigation

Status: done
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

- [x] Collapse All on Openings, then Find an owner inside a collapsed group: the owner row shows (editor-bench test, mutation-tested: dropping the reveal turns it red)
  - `WorldEditor.openingsTab.test.tsx` "opens the groups above an owner that Find jumps to"; red with the effect disabled.
- [x] The same jump to the already-selected owner also reveals it (editor-bench test)
  - "opens the groups again for an owner that is already selected"; red with the effect disabled.
- [x] Switching tabs and back with the same selection keeps the groups collapsed (editor-bench test)
  - "keeps the groups closed over a tab switch with the same owner selected".

## Landed

**Not verified**
- The `revealed` guard in the Openings effect has no red test. The hook stays mounted in the World Editor, so a tab switch never reruns the effect. The tab-switch test guards the store-held collapsed set only.
- An owner with no row yet waits for its row (no reveal is spent). No test covers it.

**For you**
- Open Openings, Collapse All, then Find an owner inside a group (Ctrl+F): the groups above it should open.
