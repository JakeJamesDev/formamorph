# 06 — Auto Arrange (dagre)

> **The layout core of this ticket is superseded by [11 — Auto Arrange: Component Split + Packing](11-auto-arrange-packing.md).** Menu wiring, scope rules, grid snapping and one-write semantics still stand as written here; how the children are actually laid out does not.

**What to build:** Right-clicking a Group offers **Auto Arrange**: a dagre layered layout over the Group's direct children, ranking on authored Connections (implicit sibling links join every pair of siblings, so they rank nothing and were dropped from the layout graph), minimizing crossings, output snapped to the grid, results written back as ordinary author-owned positions in a single world write. Nested Groups keep their internal layout (their size still adapts). Right-clicking the canvas background offers **Auto Arrange All**, the recursive variant from the root. dagre joins as a dependency.

**Blocked by:** 01 (context menu), 02 (manual-first position ownership), 04 (grid constant for on-grid output).

Status: done

- [x] "Auto Arrange" on a Group's context menu lays out its direct children; connected locations sit near each other with visibly fewer crossings than the naive layout
- [x] Nested Groups' internal arrangements are untouched; their frames resize to fit
- [x] "Auto Arrange All" on the background recurses through every Group and the root
- [x] Output positions land on the grid and persist as normal author positions (one world write per invocation)
- [x] Deterministic: the same world arranges to the same layout
- [x] Pure-mapper tests: scope (direct children only), on-grid output, determinism; Playwright: the menu action visibly rearranges a Group
