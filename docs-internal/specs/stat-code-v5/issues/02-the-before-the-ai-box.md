# 02: The Before The AI Box

Status: in-progress
Base: 910d25eb
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

A new timing through the turn module, the prompt build, live state, rollback, both re-rolls, and the save refresh, with an additive world-shape field. The breadth and the prompt plumbing earn Opus at high effort.

## What to build

Each stat gains an optional text field for code that runs before the AI. The turn order is: last snapshot, before box, prompt and AI calls, AI asks, regen, after box, new snapshot. The before box runs on the turn's starting state with the same surface as the after box. `delta` reads zeros on every member, `previous` equals `self`, and the clock is the clock at turn start with no turn hours. Its writes feed the prompt builders directly, so the prompt reads post-box stats, pins, and traits on the same turn, and the same writes go to live state so the bar shows them at once. A whitespace-only box does not run.

A turn that does not commit, whether it failed or the player stopped it, restores stats, Code Pins, and traits from the last snapshot on the path that discards the unpaired message. Both re-rolls replay the whole turn from the last snapshot, before box included. A save runs the world's current before-box code the way it runs the after box today. Code bounds persist across boxes; a box that writes none keeps them, and they clear only when both boxes are empty. Trait switches from the before box write the same log line as today.

The Code tab shows a second editor above the existing one, labeled Before The AI, with the existing one labeled After The AI. Test Code, templates, checks, and the rename offer on the new editor come in tickets 03 and 04; this ticket makes the box authorable and running.

This is an additive world export-shape change. The closing response states it.

## Acceptance criteria

- [x] A before box that pins a placeholder puts the pinned text in the same turn's narration prompt
- [x] A before box that sets a stat shows the value on the bar before the narration arrives, and the AI's stat request reads that value
- [x] `delta.ai`, `delta.regen`, `delta.total`, and `delta.actual` read zeros in the before box; `previous` equals `self`
- [x] The after box reads the state the before box left, plus the asks and regen
- [x] Bounds set in the before box survive an after box that writes none; both boxes empty clears them
- [x] A failed turn and a stopped turn restore stats, Code Pins, and traits to the last snapshot
- [x] The narration re-roll and the stats-only re-roll both run the before box again from the last snapshot
- [x] An existing save runs a before box added in the editor on its next turn
- [x] The Code tab shows two labeled editors in turn order and saves each to its own field
- [x] The e2e stat-code spec gains a case where the before box pins a placeholder and the same turn's prompt carries it
- [x] Closing response states the world export-shape change
- [x] Four gates green; graph updated

## Blocked by

- 01 — Code Runs Every Turn
