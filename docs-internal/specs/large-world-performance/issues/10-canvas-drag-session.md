# 10: Canvas Drag Session

Status: ready-for-agent
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
