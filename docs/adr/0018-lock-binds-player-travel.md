# ADR-0018 — A location's Lock binds player travel; navigation rules still bind only the AI

**Status:** Accepted · **Date:** 2026-11-13 · **Replaces in part:** [ADR-0006](0006-travel-rules-bind-only-the-ai.md)

## Context

ADR-0006 lets the player travel anywhere from the List and the Map. Only the AI router follows the navigation rules. An author who wanted a barred room could say so only in prose, and the player could still click in.

World Options added a Lock gate on locations: Requirement Rows that say when the player may enter. ADR-0006 named what extending travel rules to the player would need: every player travel surface gated by one computation, and its own UX for a locked destination.

## Decision

- **One travel gate** answers whether the player standing at one place may be moved into another. It lives on the In-Play World resolver (`canEnter`).
- **Every player move asks it:** the List, the Map, the Move-to chip at click, the router's candidate walk (a locked place is neither a candidate nor a waypoint) and the new-game start pick.
- **A script's `location.move` does not ask it.** Scripts, World Tools included, move the player in on purpose. Scripts unlock a place by writing the World Option the gate reads.
- **A lock covers its subtree.** A player already inside a lock moves freely within it; a lock nested inside still binds.
- **The AI still sees a locked place** and who is inside. Only the destinations list, the router's own list, leaves it out.
- **Navigation rules still bind only the AI.** Connections, nesting and the 3-move cap never refuse a player click. That part of ADR-0006 stands.

## Consequences

- The List and the Map show a locked place with a lock and its line: the author's Locked text, else what unlocks it with hidden Options left out, else "Locked". A click on it does nothing.
- A new travel surface must call the gate, or it opens every lock.
- Entity routines and followers ignore the Lock. It binds only the player's travel.

## Alternatives rejected

**Hide locked places from the player**: simpler, but the player loses the barred door, and the author loses the place to tell them why. Enabled already hides a place.

**Gate player travel on navigation rules too**: ADR-0006's walking-simulator cost still holds. The Lock is an authored barrier on one place, not the world's wiring.
