# 03 — Reparent Drag Highlight

**What to build:** While dragging a node, the prospective parent Group highlights live — the same innermost-Group logic that will judge the drop runs during the drag, so the highlight and the commit can never disagree. Dropping clear of every Group reads visibly as "top level" (an explicit affordance, e.g. a canvas-edge or background treatment) so unparenting is as legible as parenting. Invalid targets (leaves, the node's own descendants) never highlight.

**Blocked by:** None — can start immediately.

Status: done

- [x] Dragging a node over a valid Group highlights that Group (innermost wins for nested Groups)
- [x] Dragging over a leaf or over the node's own descendant shows no highlight
- [x] Dragging clear of all Groups shows the top-level affordance
- [x] The highlight decision and the drop decision come from one shared code path
- [x] Playwright: highlight visible mid-drag before the drop lands (static-frame evidence)
