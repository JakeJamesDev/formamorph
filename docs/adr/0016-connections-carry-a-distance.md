# ADR-0016 — A link carries a distance: Nearby or Far

**Status:** Accepted · **Date:** 2026-11-09 · **Extends:** [ADR-0002](0002-connections-override-implicit-navigation.md)

## Context

Two villages on one map share a parent, so containment links them, and the narrator heard about everyone in the next village. A per-location "Nearby Through Connections" flag decided whether Connections counted toward who is nearby. It could not make one link quieter than another, and it was a second rule to teach beside the travel graph.

## Decision

Every link between two locations has a **distance**: **Nearby** or **Far**.

- Only Far is stored, as `distance: "far"` on a Connection. Absent means Nearby. The value belongs to the pair, both legs.
- An implicit link is always Nearby. To make one Far, the author turns it into a Connection (ADR-0002 already lets that Connection replace it) and sets Far. Deleting the Connection restores the implicit Nearby link.
- **Nearby reach** is the places one Nearby link from a place: implicit neighbors and Connection ends, in either direction, never chained. It drives the Entities chip's nearby and sub-location sections, and later the narration pull.
- Distance never changes travel or following ([ADR-0006](0006-travel-rules-bind-only-the-ai.md)).
- The location flag `nearbyUsesConnections` is removed; Nearby reach counts Connections everywhere.

## Consequences

- One rule, read from one helper (`nearbyPlaces` in `src/lib/locationGraph.ts`), answers "who is close enough to hear".
- A one-way Connection is Nearby from both ends, unlike its travel.
- The canvas and the Map need a third line style: a Far arrow draws dotted.

## Alternatives rejected

**Distance per leg**: a pair that hears one way but not the other has no story meaning, and doubles the control.

**A third tier or travel time**: out of scope until a world needs it.
