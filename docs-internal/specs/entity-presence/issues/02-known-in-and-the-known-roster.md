# 02: Known In and the Known Roster

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Prompt-facing work: a new chip scope, changed default prompts, and probe runs.

## What to build

A queen in Rosewood's throne room, Known In Rosewood, reaches the AI at Rosewood's inn as a one-line summary in a new known roster, and never as present. An author manages this from the location's **Presence** tab: **Known Here** lists who is known there, with **Remove** on this location's own picks and "Known in <parent>" for inherited ones, plus a select to make another entity known here. A location can also opt its nearby roster into Connections.

## Acceptance criteria

- [ ] Known In works as the spec says: Nearby (default), Nowhere, or picked locations covering their whole subtree. Picks stay fixed when the entity moves.
- [ ] The reachable roster lists only entities whose Known In is Nearby.
- [ ] A new `<ENTITIES|known>` scope lists entities known at the player's location and not present, summary only. Highest scope wins. It never lists the persona.
- [ ] Locations gain optional `nearbyUsesConnections`. When `true`, that location's reachable roster uses the router's effective destinations. Absent means tree-only. Locations created in the editor get `true`; `migrateWorld` never sets it. The location **Presence** tab shows it as a checkbox beside Connections.
- [ ] `<ENTITIES|known>` joins every default prompt that uses `<ENTITIES|reachable>`. Each changed prompt ships with probe numbers under the probe skill, the old prompt as the in-batch control.
- [ ] Deleting a location drops it from every Known In list; an empty list falls back to Nearby.
- [ ] **Known Here** on the location Presence tab behaves as the spec says. Copy matches the spec's table; `copy:sweep` reports 0 notices.
- [ ] Tests at the presence-roster seam cover subtree picks, highest scope wins, the empty-list fallback and both `nearbyUsesConnections` states.
- [ ] Export-shape reminder in the landing reply.
