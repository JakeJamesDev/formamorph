# 04: Stable Save-State Getter

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The save-state getter keeps one identity for the session and reads the latest state from a ref (Q5). It also closes the effort with the live check of the Q3 done-state.

- On-demand callers keep working: the action snapshot and restore, the deferred snapshot, the help world sources and the handlers all still read the current state.
- The panel actions and inventory settle memos stop rebuilding on every state change.
- The getter's comment says no eager memo or effect may depend on it.

## Acceptance criteria

- [ ] A test shows the getter keeps its identity across state changes and returns the state as of the latest render.
- [ ] Taking and restoring an action snapshot still captures the current state. Existing snapshot tests pass.
- [ ] The panel actions memo keeps its identity across a choices change.
- [ ] Live probe on the dev preview, Character Mentions on, one real turn with dialogue: the card rows and speaker colors keep their identity through choices streaming and history writes, and the narration renderer never remounts. Record the sample counts in the Landed section.
