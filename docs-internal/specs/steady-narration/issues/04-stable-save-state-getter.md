# 04: Stable Save-State Getter

Status: done
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The save-state getter keeps one identity for the session and reads the latest state from a ref (Q5). It also closes the effort with the live check of the Q3 done-state.

- On-demand callers keep working: the action snapshot and restore, the deferred snapshot, the help world sources and the handlers all still read the current state.
- The panel actions and inventory settle memos stop rebuilding on every state change.
- The getter's comment says no eager memo or effect may depend on it.

## Acceptance criteria

- [x] A test shows the getter keeps its identity across state changes and returns the state as of the latest render. `GameplayContext.saveStateGetter.test.tsx`; it reads the latest committed state through `useStableCallback`. It fails when the old per-render getter or a never-updated ref is put back.
- [x] Taking and restoring an action snapshot still captures the current state. Existing snapshot tests pass. `GameViewer.panelActions.test.tsx` checks the snapshot holds the streamed choices and the new history. `GameViewer.actionList.test.tsx` (13) and `GameplayContext.actionList.test.tsx` (5) pass.
- [x] The panel actions memo keeps its identity across a choices change. `GameViewer.panelActions.test.tsx`: the panel actions and the inventory settle keep their identity across three choices writes, and the panel actions also across a history write.
- [x] Live probe on the dev preview, Character Mentions on, one real turn with dialogue: the card rows and speaker colors keep their identity through choices streaming and history writes, and the narration renderer never remounts. Record the sample counts in the Landed section. See Landed: no remount came from choices or history. Each turn had one remount, when the full-turn reading landed.

## Landed

Live probe, 2026-11-16. Setup: worktree dev preview, `entityStats` fixture (White Room with Bram), Character Mentions on, cloud Demo AI. Three real turns, each asking Bram to answer out loud. A 20 ms fiber sampler read the `MentionCardsProvider` `colors` and `rows` props and the `MarkdownRenderer` Streamdown child. Hidden-pane throttling lowered the real rate to about 50 samples per second.

| Turn | Samples | Choices writes | History writes | Colors identities | Rows identities | Remounts |
|---|---|---|---|---|---|---|
| 1 | 3450 | n/a | n/a | 1 | 1 | 1 |
| 2 | 1755 (3419 to idle) | n/a | n/a | 1 | 1 | 1 |
| 3 | 2136 | 3 | 10 | 1 | 1 | 1 |

- Each remount came after the choices finished streaming. The Streamdown key moved on its `links` and `speakers` parts: the live reading gave way to the committed full-turn reading. In turn 3, the remount landed in the same sample as the colored quotes going from 3 to 5. History writes after it caused no remount.
- That remount is the renderer's plugin keying for a new reading, which the spec's Out of Scope leaves as it is.

**Not verified**

- None.

**For you**

- Play a turn with Character Mentions on and watch for the one replay when the full-turn reading lands, after the choices. Decide whether it is acceptable or needs its own effort (the spec leaves the renderer's plugin keying out of scope).
- Follow-up named by the spec session: a history write still rebuilds the inventory settle memo, through `liveScene` → `prepareStatCode` → `runItemEvents`. It does not touch the narration.
