# ADR-0003 — Entities own their location membership

**Status:** Accepted · **Date:** 2026-08-13

## Context

Presence has been location-owned since 1.x: `GameLocation.entities` lists the entity ids present there. The planned entity-range feature ("the bartender frequents the Bar and the Docks") describes an *entity's* behavior, and an entity spanning five locations is five scattered list memberships under location ownership. Runtime-discovered characters already carry their own `locationId` on the gameplay side.

## Decision

Flip ownership: an **entity owns the list of locations it belongs to**; `location.entities` is migrated away (hard flip, idempotent migration inverting existing worlds, in `version.ts`). Semantics are unchanged by the flip — an entity listing multiple locations is present at all of them simultaneously — until the range feature distinguishes residence from frequenting. Rosters that today read `location.entities` read an inverted index instead.

## Consequences

- This is the largest export-shape change of the Location Graph work — world JSON both gains a field and loses one, so it is version-bump + migration territory (user-managed).
- Authored entities and runtime `DiscoveredEntity` (which already carries `locationId`) now agree on ownership direction; saves need no change.
- The future range feature lands as a refinement of one entity-side field instead of a second membership system.

## Alternatives rejected

**UI-only flip** (storage stays location-owned): no shape change, but the range feature would sit on backwards storage and the model would permanently contradict the language.

**Dual-write transition** (both fields mirrored for a release): two sources of truth to keep honest — sync code that breeds bugs, for a safety margin migration already provides.
