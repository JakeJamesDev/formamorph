# 09 — Minimap & Location Search

**What to build:** Fullscreen-only orientation aids. A minimap (themed to match both app themes) shows the whole graph with the current viewport, and clicking/dragging it navigates. A search box on the fullscreen chrome matches locations by name as you type; choosing a match pans/zooms the canvas to that node and flashes it. Neither appears in the embedded view.

**Blocked by:** 05 (fullscreen shell).

Status: done

- [x] Minimap renders in fullscreen, themed for light and dark; embedded view has none
- [x] Minimap reflects the viewport and supports click/drag navigation
- [x] Search matches location names; selecting a result centers and flashes the node
- [x] Search finds nodes nested inside Groups, not just top-level
- [x] Playwright: search jump lands the target node in view (static-frame evidence)
