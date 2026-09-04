# 01 — Controls Remap, Multi-Select & Context Menu

**What to build:** The Locations Canvas adopts node-editor-standard controls. Left-drag on empty canvas rubber-band-selects nodes; Shift/Ctrl+click adds or removes from the selection; dragging any selected node moves the whole selection as a unit, and a multi-drag reparents each node by the same innermost-Group rule. Middle-drag or right-drag pans. A right-*click* (no drag) opens a canvas context menu — on a node, a Group, the background, or a multi-selection — replacing the browser menu; a right-drag pan must not open it on release. Esc clears the selection, Ctrl+A selects all. The menu ships with starter actions (e.g. open the location's editor) so it is demoable before Auto Arrange exists; later tickets add entries.

The WorldEditor's single-selection continues to track the last-selected node; multi-selection state belongs to the canvas.

**Blocked by:** None — can start immediately.

Status: done

- [x] Left-drag on empty canvas draws a marquee and selects the enclosed nodes; left-drag on a node still moves it
- [x] Shift/Ctrl+click toggles a node's membership in the selection
- [x] Dragging one selected node moves the entire selection; dropping reparents each node by the existing innermost-Group rule
- [x] Middle-drag and right-drag both pan; the native context menu never appears over the canvas
- [x] Right-click without drag opens the canvas menu with at least one working action; right-drag does not open it
- [x] Esc clears the selection; Ctrl+A selects all nodes in the canvas
- [x] Single-selection sync with the WorldEditor list is unchanged
- [x] Pure-mapper tests for multi-drop intents; Playwright covers marquee + unit-drag and right-click-vs-right-drag
