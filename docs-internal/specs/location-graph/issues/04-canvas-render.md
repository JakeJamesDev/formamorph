# 04 — Canvas: render the world

**What to build:** A list ⇄ canvas view toggle in the Locations panel, rendering the world as a node graph with @xyflow/react 12 (MIT): containment as nested group boxes (no parent↔child lines — the box is the relationship), implicit sibling travel as tightly-coupled dashed arrows (one per direction), authored Connections as primary-colored solid arrows (one arrow per travelable direction; count arrows, not arrowheads), and locations unreachable from any starting location badged. Authors drag nodes to arrange the map; positions persist in the world as an editor-only field, surviving reload and export. Connection editing and reparenting come in tickets 05/06 — this ticket's canvas is a correct, arrangeable map. The visual vocabulary was validated in `prototype.html` beside the spec.

A pure mapper layer converts world data → node/edge props; the xyflow component is a thin shell over it. All canvas logic that can be tested lives in the mapper.

**Blocked by:** 02 — Connection records and effective navigation.

Status: ready-for-human

- [x] @xyflow/react added; license noted MIT
- [x] View toggle in the Locations panel; list remains fully functional
- [x] Mapper tests: grouping, dashed implicit pairs (overridden pairs draw nothing implicit), one solid arrow per travelable direction, hint labels, unreachable badge flags
- [x] Overridden pair renders only the Connection's arrows — no implicit remnant
- [x] Node drag persists position (editor-only field, never sent to the AI); export-shape reminder in the response
- [x] Opening a location's full editor from its node
- [x] Dev-route entry so the canvas is reachable in one goto; drift-guard test green
- [x] Verified in the live preview at realistic viewport, static evidence, both themes
- [x] Four gates green; changelog In-Progress entry appended

## Comments

**A group's size is derived from its children, so it can't also fence them in.** xyflow's `extent: 'parent'`
clamps a child to the parent's current box — and since `measure()` sizes that box from where the children
sit, the rightmost child is pinned against a wall that only moves if it moves. Sub-locations are therefore
unclamped, and `withCanvasPosition` holds them clear of the frame and title strip instead: the box grows
down and right, and nothing can be dragged out through the top-left corner.

**Unplaced locations flow in beneath the ones the author placed.** Default placement is size-aware (a wide
group pushes its neighbor over rather than being sat on) and starts below anything with a stored position,
so a location added to an arranged map never lands on the arrangement. This is placement, not the
auto-layout the spec rules out — nothing re-arranges what the author has touched.

**One nuance left for 05:** a Connection between a parent and its child suppresses the implicit link
correctly, but the box still reads as free travel in both directions, since containment draws no line by
design. Materializing implicit arrows (05) is where that wants a decision.

**The verification pane can't run this canvas.** `ResizeObserver` never fires in the in-app preview pane, so
xyflow never measures its nodes and draws zero edges there — the app is fine, the pane is not. Evidence for
this ticket came from a throwaway Playwright run against the dev server: 9 nodes / 10 edges / 4 dashed / 3
hint labels / 1 unreachable badge, both themes, drag persisted through save and reload.
