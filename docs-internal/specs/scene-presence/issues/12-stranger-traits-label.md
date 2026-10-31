# 12: Keep Strangers' Traits Under Their Label

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

In the Traits tab, a stranger's own trait names and descriptions resolve before the node is relabeled. A trait that uses the Character Name placeholder can then show the true name. Two strangers who share a label also show as two identical nodes. Resolve a stranger's trait text with the label, and number shared labels as the stat picker does (Q78).

## Acceptance criteria

- [ ] A stranger's trait whose name or description uses the Character Name placeholder shows the label, never the true name.
- [ ] Two strangers with the same label show as numbered, distinct nodes in the Traits tab.
- [ ] A past-page Traits tab test covers both.
- [ ] Each test fails when its old behavior is put back.
