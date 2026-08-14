# ADR-0004 — The Locations Canvas is manual-first; Auto Arrange is an explicit command

**Status:** Accepted · **Date:** 2026-08-14

## Context

The first canvas pass shipped a hybrid layout: locations without a stored `canvasPosition` are laid out by a row-wrapping flow pass on every render, and dragging a node writes `canvasPosition`, permanently exempting it. The remaining unplaced siblings then reflow beneath the placed nodes' bounding box, so moving one node visibly shuffles others. Authors experienced this as a random "auto nudge" with no way to rejoin a node to the automatic layout and no way to reset a Group to a clean layout.

## Decision

Positions are **author-owned and stable** — nothing on the canvas moves unless the author moves it or explicitly asks for a layout:

- A location created in the editor receives a concrete `canvasPosition` immediately, from a deterministic placement heuristic.
- Locations arriving without positions (legacy worlds, imports) are placed by a deterministic fallback that never reacts to authored positions — same world in, same layout out. The world is not dirtied by merely opening the canvas; positions persist only when the author moves or arranges.
- The live reflow is removed entirely.
- **Auto Arrange** is the only automatic layout: an explicit per-Group command that lays out that Group's direct children using **dagre** (layered layout, edge-crossing minimization over the travel graph), snapped to the grid, writing the results back as ordinary author positions. An "Auto Arrange All" variant recurses from the root.

## Consequences

- Layout is predictable: an author's arrangement is exactly what they last left, plus nothing.
- After an Auto Arrange, every affected location carries a populated `canvasPosition` in the world export. The field already existed as optional — no shape change — but exports become position-dense.
- dagre becomes a dependency (~30KB, MIT, the standard xyflow companion).
- Undo must treat Auto Arrange as one step, since it rewrites many positions at once.

## Alternatives rejected

**Live layout with pins**: keep the flow engine active, badge manually moved nodes as "pinned" with an unpin action. Preserves auto-tidiness but retains the two-regime model that made the first pass feel random.

**Auto/Manual mode toggle per Group**: clean separation, but adds a mode the author must discover and understand, and toggling to Auto destroys manual work wholesale.
