# 11 — Auto Arrange: Component Split + Packing

Status: ready-for-agent
**Supersedes the layout core of:** 06 (menu wiring, scope rules, grid snapping, one-write semantics all stand)

## Problem Statement

Auto Arrange arranges nothing in the common case. A Group whose sub-locations have no authored Connections comes out as one straight line — every child in a single column — because the layered layout is handed no edges and gives every node the same rank. The command an author reaches for to *tidy* a messy Group instead produces a shape no one would draw by hand. (The first attempt, feeding implicit sibling travel in as edges, produced the opposite degenerate shape: a one-node-per-column staircase, 880px wide for four children.)

## Solution

Auto Arrange lays out what actually has structure and packs what doesn't. Sub-locations joined by authored Connections form clusters and keep the layered left→right layout — linked places stand in travel order with crossings minimized. Everything else, and each cluster as a unit, is packed into a compact wrapping grid that aims at a roughly screen-shaped (~16:10) block. A Group with no Connections becomes a tidy grid; a wired chain stays a readable chain; a mixed Group gets both, side by side. Output still lands on the grid, still persists as ordinary author positions, still one world write.

## User Stories

1. As a world author, I want Auto Arrange on a Group with no Connections to produce a compact grid, so that the command tidies rather than smears.
2. As a world author, I want sub-locations linked by Connections to stand near each other in travel order, so that the arranged map reads like the world navigates.
3. As a world author, I want arrows between arranged locations to stop crossing, so that the result is more readable than what I had.
4. As a world author, I want unlinked sub-locations to share rows rather than columns of their own, so that a plain twelve-room Group fits on my screen.
5. As a world author, I want a large Group to arrange into a landscape block rather than a ribbon, so that I can see all of it at one zoom level.
6. As a world author, I want the packed order to follow the order of my locations list, so that the arrangement mirrors how I organized the world.
7. As a world author, I want a cluster of linked places to occupy the slot of its earliest member, so that arranging doesn't shuffle my mental order.
8. As a world author, I want nested Groups to keep their internal arrangement, so that tidying a parent never destroys work inside a child.
9. As a world author, I want a nested Group's frame to resize around what it holds, so that the packed layout is measured on real sizes.
10. As a world author, I want Auto Arrange All to arrange every Group and the top level in one action, so that a whole world resets in one press.
11. As a world author, I want arranged positions on the same grid my drags snap to, so that automatic and manual layout share one rhythm.
12. As a world author, I want the same world to arrange the same way every time, so that the command is predictable.
13. As a world author, I want the whole arrangement to be a single edit, so that undo (ticket 08) takes it back in one step.
14. As a world author, I want a Connection's authored direction to set the left→right order even when travel is two-way, so that links I wrote in reading order lay out in reading order.
15. As a world author, I want links between a Group and its own children — or from outside the Group — to leave the layout alone, so that only the structure *inside* the box shapes the box.

## Implementation Decisions

- The pure layout module keeps its two entry points (per-group arrange, recursive arrange-all) and its contract: world plus connections in, world with rewritten direct-child positions out, same-array return when there is nothing to arrange.
- Direct children split into connected components over authored Connections whose **both ends are direct children** of the group being arranged. Boundary edges (group↔child, outside↔child) are ignored. Implicit sibling travel is never a layout edge — it joins every pair, so it ranks nothing (measured: complete graph → four-column staircase; no edges → single column).
- Components of ≥2 members go to dagre, rankdir left→right, one edge per pair, authored from→to as the direction even for two-way records; a component's output becomes one composite box.
- Every component — 1-node components included, no special case — is a box with the measured size the canvas mapper reports (so nested Group frames are real sizes).
- Boxes pack into wrapping rows (shelf packing) in world order; a multi-member cluster sorts by its earliest member. Wrap width derives from total box area targeting ~16:10, floored at the widest single box; the mapper's legacy fallback row width is not reused.
- Row/box gaps use the existing arrange gap (two grid cells); final positions snap to the canvas grid and rebase onto the frame's near corner (or 0,0 at top level).
- Arrange-all folds deepest-first then the top level, unchanged — a parent packs around child frames that are already final.
- Menu wiring unchanged: Auto Arrange on any box that holds something, Auto Arrange All on open canvas, one world write each.
- dagre stays a dependency; no new ones.
- No export-shape change: `canvasPosition` already exists; exports stay position-dense after arranging.

## Testing Decisions

- Good tests assert observable geometry — stored positions and mapper-reported frames — never the packer's internals. Prior art: the ticket-06 suite (scope, on-grid, determinism, crossing/rank assertions, deepest-first ordering) in the pure-layer test file; keep every test that still describes wanted behavior.
- Replace the "one rank" test with grid-shape assertions: N plain children arrange into multiple rows *and* multiple columns (neither 1×N nor N×1) with no overlaps.
- Aspect assertion: a larger plain Group's bounding block is wider than tall but within a sane band — not a ribbon either way.
- Cluster tests: a wired chain still orders left→right and uncrosses; a mixed Group keeps the chain intact as a unit while loose children pack beside it; cluster occupies its earliest member's slot.
- Mutation-test every guard (drop the component split, drop the wrap, pack in size order, re-admit boundary edges) and watch the named test go red.
- The existing Playwright menu test stands: stacked children visibly un-stack and the world keeps the result. No new e2e needed.

## Out of Scope

- Undo (ticket 08 already covers Auto Arrange as one step via the single write).
- Fullscreen-toolbar Auto Arrange buttons (ticket 10).
- Align/distribute on a multi-selection (ticket 10).
- Any change to fallback placement for never-positioned locations, or to creation placement.
- Force-directed or any non-deterministic layout (rejected: determinism requirement).

## Further Notes

- ADR-0004 governs: Auto Arrange stays the only automatic layout, explicit, positions handed back to the author. Its dagre mention still holds — dagre now serves the part of the problem it is actually good at.
- The changelog entries written under ticket 06 (user-facing and developer) must be **rewritten in place**, not appended to — nothing has shipped, so the In-Progress section describes only the final behavior.
- Ticket 06's issue file gets a pointer to this one for the layout core.
