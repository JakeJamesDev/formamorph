# 12: Keep Strangers' Traits Under Their Label

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

In the Traits tab, a stranger's own trait names and descriptions resolve before the node is relabeled. A trait that uses the Character Name placeholder can then show the true name. Two strangers who share a label also show as two identical nodes. Resolve a stranger's trait text with the label, and number shared labels as the stat picker does (Q78).

## Acceptance criteria

- [x] A stranger's trait whose name or description uses the Character Name placeholder shows the label, never the true name. (`TraitsTab.test.tsx`, "reads a stranger’s trait text with its label…": name and description)
- [x] Two strangers with the same label show as numbered, distinct nodes in the Traits tab. ("numbers strangers who share a label…")
- [x] A past-page Traits tab test covers both. (`page: 1` with per-turn `ownedTraits` snapshots)
- [x] Each test fails when its old behavior is put back. (Emptied the stranger set: both fail. Removed `numbered`: the numbering test fails.)

## Landed

**Not verified**
- Group names of a stranger's own trait groups: `withStrangerNames` handles them, no test covers them.
- A stranger's linked world traits: they read the label through `withOwnerNames`, no test covers them.
- Not checked in the Browser pane.

**For you**
- None.
