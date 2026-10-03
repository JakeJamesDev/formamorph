# 14: Extract the tuned defaults

Status: ready-for-agent
Blocked by: 08, 09, 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The default rig becomes what the user tuned in-app, not what ticket 01 guessed.

- The user edits the rig on the Mascot tab: layers, overlays, order, switches, the three picks, the Mask, the Voice and the transition. When they say the rig is ready, this ticket reads the stored help settings on their device (or a mascot card they export) and writes that rig into the default rig in code, with the bundled assets in place of stored image ids.
- Nothing is built for authoring defaults; the tab is the authoring tool (Q32).
- Reset on the tab restores the new default.

Spec: Q32; Implementation → Mascot module.

Recommended model rationale: a data extraction with a known shape and existing tests to keep green.

## Acceptance criteria

- [ ] The default rig in code equals the user's tuned rig, with bundled assets for its images.
- [ ] The composition and codec tests pass against the new default without a changed assertion, and the default-rig test names the tuned picks.
- [ ] Reset on the tab restores the tuned default.
- [ ] The four gates are green.
