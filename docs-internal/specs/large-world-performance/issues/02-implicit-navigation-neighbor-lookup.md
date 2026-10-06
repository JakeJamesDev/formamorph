# 02: Neighbor Lookup for Implicit Navigation

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Recommended model rationale: a behavior-preserving prefactor across navigation, migration and reachability; parity tests carry it.

## What to build

Prefactor for tickets 03 and 04. Implicit Navigation (parent, children, siblings; ADR-0002 overrides) is computed today by listing every sibling pair in the world, which is O(k²) for a location with k children. Every caller that only needs one location's neighbors, or reachability from the starting locations, switches to a per-location neighbor lookup built from a parent index: effective destinations in play, reachability from starts, the location tree's travel helpers, and world migration.

Gameplay, migration output and the Test Bench findings stay exactly the same. The pair enumeration stays only where a caller truly needs all pairs; if none remains after ticket 03, ticket 03 removes it.

## Acceptance criteria

- [ ] A parity test compares neighbor lookup with the old pair enumeration on fixtures with nesting, top-level locations, one-way and two-way Connections, and overridden pairs.
- [ ] Effective destinations, reachability from starts, and migration produce identical results on the bundled worlds and the bench world.
- [ ] On the bench world, reachability from starts and one location's destinations no longer enumerate sibling pairs (a unit timing shows linear growth with child count).
- [ ] Guard bites: making the lookup skip siblings turns the parity test red.
- [ ] Four gates green.
