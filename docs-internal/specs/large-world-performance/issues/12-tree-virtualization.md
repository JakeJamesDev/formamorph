# 12: Tree Virtualization

Status: done
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

## Results

Harness at 6x on the bench world. Base and new builds ran alternately, three rounds, so machine load hit both arms alike. A quiet-machine base run before the A/B gave frame p95 83–100 ms, max frame 1.8–2.1 s, max block 1.7–2.0 s.

| Step | Base (3 runs) | New (3 runs) |
|---|---|---|
| `treeDrag` frame p95 | 83–117 ms | 33 ms |
| `treeDrag` max frame | 3.0–3.9 s | 200 ms |
| `treeDrag` blocks / max block | 19–21 / 2.9–3.8 s | 3–4 / 179–184 ms |
| `treeDrag` heap | 264 MB | 214 MB |
| `open` max block | 2.8–8.2 s | 2.1–2.4 s |

- `treeDrag` meets Q1: p95 under 100 ms, no block over 1 s.
- `open` still blocks over 1 s. Ticket 14 owns open's Q1.
- E2E on desktop: `tree-virtualization`, `trait-tree-drag` and `dictionary-drag` pass. `editor-list-drag` times out finding its grip before the drag starts, the same way on base sources. On mobile every drag spec fails on base too: the World Editor never opens there.
- The tree windows above 200 visible rows, the same threshold the dictionary uses. The selected row stays mounted, so the find bar can still bring it on screen.
