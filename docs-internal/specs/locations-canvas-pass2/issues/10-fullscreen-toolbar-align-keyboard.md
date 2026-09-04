# 10 — Fullscreen Toolbar, Align/Distribute & Keyboard

**What to build:** The fullscreen toolbar assembles the power tools: Auto Arrange (current selection's Group, or root when nothing is selected), snap and grid-visibility toggles, the connection-style picker, and align/distribute for multi-selections (align left/top, distribute horizontally/vertically) — align/distribute also joins the multi-selection context menu. Keyboard finishing moves: F zooms to the current selection (fit-view when nothing selected), arrow keys nudge the selection by one grid cell (undoable, coalescing repeats sensibly). Embedded view remains toolbar-free.

**Blocked by:** 01 (multi-select), 04 (toggles), 05 (shell), 06 (Arrange), 07 (style picker).

Status: done

- [x] Toolbar in fullscreen offers Arrange, snap/grid toggles, style picker, align/distribute; none of it renders embedded
- [x] Align left/top and distribute horizontal/vertical act on the multi-selection and are undoable as one step each
- [x] F zooms to selection; arrow keys nudge the selection one grid cell per press, undoably
- [x] Toolbar controls mirror the same prefs as the context menu (one source of truth)
- [x] Playwright: align stacks selected nodes' edges; F frames the selection (static-frame evidence)
