# 12: Tree Virtualization

Status: ready-for-agent
Blocked by: 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: virtualizing a dnd-kit tree without changing drag feel is subtle: off-screen droppables, auto-scroll, jsdom rects, and ADR-0007 invariants.

## What to build

Long editor trees mount only the rows near the viewport, with no visible change. The dragged row and its drop neighborhood stay mounted while dragging; auto-scroll still reaches off-screen rows. ADR-0007 holds: the drag layer, stable items, hover suppression, translate-only rows, and no bounding clamp on X for depth-nesting trees. Follow the dictionary tree's existing virtualization as prior art, including its jsdom initial rect. Report `npm run profile:editor-speed` steps before and after at 6x in the ticket (Q7).

## Acceptance criteria

- [ ] With 400 entities, the tree mounts far fewer than 400 rows (count asserted).
- [ ] Scrolling shows every row in order; keyboard navigation still reaches every row.
- [ ] e2e: dragging a row past the visible end auto-scrolls and drops in the right place, with depth changes intact.
- [ ] Editor-list, trait-tree and dictionary drag e2e specs pass unchanged.
- [ ] Harness `treeDrag` at 6x: drag frames p95 under 100 ms, no block over 1 s.
- [ ] Four gates green.
