# 10: Canvas Drag Session

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: a contained geometry change with an existing drag-session seam.

## What to build

Dragging a location on the canvas costs O(N) per pointer move, not O(N²). The drag session built at drag start also holds each location's descendant set and a has-children set; per-move hit tests read those instead of rebuilding maps per location. The drop-target value changes only when the target changes, so group frames don't re-render every frame. Report `npm run profile:editor-speed` steps before and after at 6x in the ticket (Q7).

## Acceptance criteria

- [ ] Unit: drop intents for single and multi-select drags equal the current results on nested fixtures.
- [ ] Harness `canvasDrag` step at 6x: drag frames p95 under 100 ms, no block over 1 s.
- [ ] Guard bites: rebuilding the descendant check per location brings the per-move cost back (numbers recorded).
- [ ] Four gates green; canvas e2e spec green.

## Comments

### Implementation results (2026-10-06)

The session now holds `depths`, `descendants` and `parents`. Every per-move judge reads them (`dropTarget`, `leafTarget`, `dropIntent`, `multiDropIntents`). The canvas sets its drop-target state only when the target changes.

- **Unit parity:** 65 lines pinned from the old code on a nested fixture (`src/lib/canvasDragSession.test.ts`): box, leaf, carried leaf, drop, armed drops, and three multi-selects. The session and the bare world both match.
- **Guard bites:** the frame-cost test compares a 400-location map with a 1,600-location map. Old code: ratio 19.4 (21.3 s). Per-location `isDescendantLocation` put back in the old order: ratio 20.7 (18.4 s). Fixed code: under 9 (26 ms total). Hit test alone on the bench shape (300 locations, 150 under one parent), per pointer move, unthrottled: 9.8 ms before, 0.015 ms after (about 59 ms before and 0.1 ms after at 6x).
- **Edge cases:** a location whose parent is missing counts as top-level, and a parent cycle terminates. Each test went red when its guard was removed (the cycle test hangs).
- **Not covered by a test:** that the drop-target state keeps its identity on a frame with the same target. A render-count test would break the test rule, so only the harness exercises it.
- **Gates:** typecheck, changed-file lint, affected tests (191 files, 2,406 tests, 107 s) and build green, as the gate list in `.claude/ticket-worktrees.json` runs them. `e2e/location-canvas.spec.ts`: 36 passed, 4 skipped by the spec itself.

`canvasDrag` at 6x, three runs each, old and new bundles alternated on one machine (other sessions were running, so single runs vary a lot):

| Run | Move p50 (ms) | Frame p95 (ms) | Frame max (ms) | Longest block (ms) | Blocks over 50 ms |
|---|---|---|---|---|---|
| Before 1 | 151 | 267 | 1467 | 1427 | 73 |
| Before 2 | 157 | 200 | 1017 | 1001 | 55 |
| Before 3 | 211 | 333 | 917 | 880 | 88 |
| After 1 | 105 | 150 | 733 | 704 | 36 |
| After 2 | 155 | 867 | 2633 | 1552 | 75 |
| After 3 | 129 | 250 | 967 | 968 | 52 |

Medians: move p50 157 to 129 ms, frame p95 267 to 250 ms.

**The bar is not met.** Frame p95 stays above 100 ms, and blocks over 1 s still occur. The hit test is no longer in the pointer-move profile. The remaining time is React and xyflow rendering after each node change (script about 58% of main-thread time; style, layout and paint about 10%), and the release and Ctrl+Z commits (about 0.6 to 1.0 s each, where the dirty check runs). That belongs to other tickets: 13 owns the dirty check, 11 and 14 own re-render cost. It needs a ruling on whether this ticket's bar moves or a render-path ticket follows.

Harness additions: `EDITOR_SPEED_PROFILE=1` prints the top self-time functions during the pointer moves and the main-thread time by trace event. `canvasDrag` now also reports `moveP50`, `moveP95`, `moveMax`, `releaseMs` and `undoMs`.
