# 06 — Canvas: reparenting

**What to build:** Dragging a location into or out of a containment box changes its parent — the canvas edits structure, not just links. On drop, implicit navigation, dashed arrows, and reachability badges all recompute, and the existing list view reflects the new nesting. Drag ambiguity (moving a node vs reparenting it) must be resolved deliberately — a drop is a reparent only when it lands inside/outside a group box, otherwise it is a position move.

**Blocked by:** 04 — Canvas: render the world (parallel to 05).

Status: done
Status note: (65fd5e6)

- [x] Drag into a group box → that location becomes the parent; drag out to top level → parent cleared
- [x] Position move without crossing a box boundary never reparents
- [x] Implicit dashed arrows and unreachable badges recompute on drop
- [x] Authored Connections survive reparenting unchanged (id-based, containment-independent)
- [x] List view and canvas agree on nesting after every drop
- [x] Reparent intent unit-tested at the mapper (drop geometry → parent mutation vs position mutation)
- [x] Verified in the live preview via the dev-router with static evidence
- [x] Four gates green; changelog In-Progress entry appended

## Comments

**Deliberate cut:** only a **group box** is a container. A childless location is drawn no larger than its own
name, so treating it as a drop target would turn two nodes brushing past each other into nesting nobody asked
for. A location therefore cannot gain its *first* child on the canvas — that still goes through the list view.
Worth a follow-up ticket if the canvas should be able to create nesting from scratch.
