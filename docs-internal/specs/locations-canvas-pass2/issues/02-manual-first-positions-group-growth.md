# 02 — Manual-First Positions & Group Growth

**What to build:** The canvas becomes manual-first per ADR-0004: nothing moves unless the author moves it. Creating a location writes it a concrete canvas position immediately via a deterministic placement heuristic (below its Group's existing content). Locations arriving without positions (legacy worlds, imports) are placed by a deterministic fallback that never reacts to authored positions — same world in, same layout out — and opening the canvas alone never dirties the world; positions persist when the author moves or arranges. The reactive re-layout that reflowed unplaced nodes on every render is deleted.

Dragging a child past its Group's inner top/left bound grows the Group instead of snapping the child back: the Group's origin shifts and its other children's relative coordinates are rebased so nothing visually moves. Right/bottom growth already works.

**Blocked by:** None — can start immediately.

Status: done

- [x] Moving one node never changes any other node's rendered position
- [x] A newly created location appears at a sensible spot in its Group without disturbing siblings, and carries a persisted position
- [x] A world with unpositioned locations renders the same layout every time it is opened, and opening the canvas does not mark the world dirty
- [x] Dragging a child left of or above the Group's inner bound expands the Group; siblings stay visually fixed (origin shift + rebase)
- [x] The reactive flow layout is gone — no code path re-lays-out placed or unplaced nodes at render time
- [x] Pure-mapper tests: placement determinism, placed siblings do not perturb fallback placement, rebase leaves siblings' absolute positions unchanged
