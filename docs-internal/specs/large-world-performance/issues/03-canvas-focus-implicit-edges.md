# 03: Focus-Only Implicit Edges on the Canvas

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Recommended model rationale: a contained canvas change with clear rulings, but e2e specs and touch behavior need care.

## What to build

The Locations Canvas stops drawing the full sibling mesh (Q2). Sibling Implicit Navigation edges show only for focused locations (Q20): the hovered location, the selected location, or the union of a multi-selection. A selected location keeps its edges after the detail panel closes, so touch can author. Edges hide while a location is dragged. Clicking a shown dashed edge still authors a Connection. Overridden pairs keep drawing their Connection arrows and never an implicit edge (ADR-0002). Containment stays the frame; no child-to-parent edge is drawn (Q9).

Turn on viewport culling for the canvas. The canvas graph builder takes the focus set and emits only those locations' implicit edges.

Update the existing canvas e2e specs that click an implicit edge so they select a location first. One changelog fragment, Minor Fixed, 👤. Report `npm run profile:editor-speed` steps before and after at 6x in the ticket (Q7).

## Acceptance criteria

- [ ] With no focus, the bench world canvas draws zero implicit edges; Connection arrows still draw.
- [ ] Hovering a location shows its sibling implicit edges; leaving hides them unless it is selected.
- [ ] Selecting two locations shows the union of both locations' implicit edges.
- [ ] Starting a drag hides implicit edges; ending it restores them for the focus.
- [ ] e2e: select a location, click its dashed edge, and a Connection is authored and selected.
- [ ] e2e at touch width: tap a location, close the detail panel, and its edges are still shown and clickable.
- [ ] Unit: the builder's edge set for a focus equals that location's siblings minus overridden pairs.
- [ ] Harness `canvas` step on the bench world at 6x: no main-thread block over 1 s.
- [ ] Guard bites: emitting all pairs again turns the zero-edge unit test red.
- [ ] Four gates green; canvas e2e spec green.
