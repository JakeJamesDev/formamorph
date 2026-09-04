# 05 — Canvas: Connection editing

**What to build:** The canvas becomes the primary Connection editor: drag between two locations to create a Connection (defaults two-way), select an arrow to toggle direction, flip one-way orientation, edit the travel hint, or delete, and click a dashed implicit arrow to materialize it into an authored Connection ready for annotation. Every gesture produces a world mutation through the mapper layer; dashed/solid rendering and reachability badges update immediately, so narrowing travel (e.g. materializing then making one-way) is visible the moment it happens.

**Blocked by:** 04 — Canvas: render the world.

Status: ready-for-human

- [x] Drag-to-connect between any two locations; new Connection defaults two-way
- [x] Select a Connection: direction toggle, orientation flip, hint edit, delete
- [x] Click a dashed implicit arrow → authored two-way Connection replacing that pair's implicit link
- [x] Gesture→mutation intents unit-tested at the mapper (connect, materialize, edit, delete)
- [x] Canvas and list editor stay consistent — same records, either surface shows edits from the other
- [x] Reachability badges recompute on every edit
- [x] Verified live via the dev-router with static evidence — Playwright, not the preview pane (see below)
- [x] Four gates green; changelog In-Progress entry appended

## Comments

**The direction control reads the pair's ends in a fixed order, not the record's own.** A one-way direction
is stored by rewriting `from`/`to`, so the record's ends swap under a flip — a control worded from them would
relabel and reorder itself under the author's hand every time they clicked it. `connectionEnds` sorts the two
ids, so "Tavern → House" stays in the same place whichever way the link currently runs.

**Selection follows the record, not the arrow.** Flipping a one-way link destroys the arrow that was
selected and creates its opposite, so a panel pinned to an arrow's id would close on the click that changed
it.

**Drag-to-connect needed a grip, not a whole-node handle.** A node has to stay draggable to move, so the
source is a small dot on its edge; the drop target only exists while a Connection is being drawn, and covers
the whole box then — a group's cover is its title strip, so the sub-locations inside it stay their own
targets. The cover carries the verdict: xyflow marks it `valid` only where the drop would be accepted, so a
pair that already has a Connection lights red rather than swallowing the drag. `isValidConnection` asks
`connectIntent` itself, so the drawn feedback and the landed result cannot disagree.

**The canvas speaks the list panel's direction vocabulary.** A first pass invented `CanvasDirection`
(`forward`/`backward`) and re-derived the endpoint rewrite that `withDirection` already owned. It now reuses
`ConnectionDirection` with `connectionEnds[0]` standing in for the location a list panel would be open on,
so the rule that a one-way direction rewrites `from`/`to` lives in one place. `withHint` moved to
`connectionEditing` for the same reason, and picked up a trim on the way: a hint of only spaces now drops
the field like an empty one, while a space being typed mid-hint survives.

**The parent↔child nuance 04 left open is unchanged.** A Connection between a parent and its child
suppresses that pair's implicit link and draws its own arrows, but the containment box still reads as free
travel in both directions, since containment draws no line by design. Drag-to-connect can now author that
pair, so the ambiguity is reachable — it wants a visual answer (a marked box, or a rule against the gesture)
that is its own decision, not part of this ticket.

**Verification, and one thing it found.** The in-app preview pane still cannot run xyflow (04's
`ResizeObserver` note), so evidence came from a throwaway Playwright run against the dev server on a seeded
world — Village > {Tavern, House}, plus Landing and an unreachable Shore. Desktop, both themes: materialize
2 dashed → 2 solid, narrow to 1 arrow, flip, hint drawn on the arrow, the list panel reading the same record
from the other end as *Incoming* with the hint, delete restoring both dashed arrows; and a drag from Landing
to Shore producing 2 arrows with the unreachable badge clearing, then 1 arrow with the badge back.

At the mobile viewport the inspector panel cannot be tapped: `ListDetail` wraps the mobile list pane in a
`ScrollArea` whose viewport sits over the canvas, and the desktop pane's existing canvas opt-out has no
mobile twin. Nodes and arrows themselves render fine there. Left alone — it is a `ListDetail` change shared
by every editor tab, not a Connections one.
