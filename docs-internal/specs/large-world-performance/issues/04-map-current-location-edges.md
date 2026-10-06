# 04: Current-Location Edges on the Map

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: reuses ticket 03's focus-set builder on the readonly Map.

## What to build

The in-play Map shows Implicit Navigation edges from the player's current location, plus the hovered location's edges on desktop (Q23). Connection arrows draw as today; overridden pairs follow ADR-0002. Viewport culling is on. Clicking a location still travels. One changelog fragment, Minor Fixed, 👤.

## Acceptance criteria

- [ ] On a world with 150 siblings, the Map draws only the current location's implicit edges (count equals its sibling count minus overridden pairs).
- [ ] Traveling moves the drawn edges to the new current location.
- [ ] Hovering another location on desktop adds its edges; leaving removes them.
- [ ] Clicking a location still travels there.
- [ ] Guard bites: drawing all pairs again turns the edge-count test red.
- [ ] Four gates green.
