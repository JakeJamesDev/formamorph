# 02: Shared Card Collapse

Status: done
Base: 2d47fda4
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Spec: [Openings Refresh](../spec.md) (stories 47–54; Q21, Q22)

## What to build

Opening cards collapse the way placeholder value cards do. Both editors take their open state from one shared collapse module, so they can't drift:

- A list of three or more rows opens with every card collapsed; a shorter list opens expanded. A newly added card opens expanded.
- A collapse-all / expand-all control sits in the list header.
- A collapsed opening card shows its drag handle, "Opening N", the first line of its text with an ellipsis, the kind switch, weight, chance and delete. Every control stays live, and dragging works while collapsed.
- Nothing about collapse state persists.

The placeholder values editor changes its open-on-mount default to the same rule.

## Acceptance criteria

- [ ] One module owns the open-state rule; the opening cards and the placeholder value cards both use it.
- [ ] The World Details suite covers open-on-mount at 2 and 3 rows, a new row opening expanded, collapse-all, and a weight edit and a reorder while collapsed.
- [ ] The placeholder manager suite covers the new open-on-mount rule.
- [ ] Verified in the live preview on a list of 3+ openings.
- [ ] Four gates green; changelog In Progress entry.
