# ADR-0006 — Travel rules bind only the AI router; the player travels freely

**Status:** Accepted · **Date:** 2026-08-18

## Context

Navigation rules (implicit navigation plus authored Connections, per ADR-0002) produce an effective destination set for any location. The AI location router is bound to it structurally: it is only ever offered that candidate list, and its reply is only matched against those names.

The player has a separate travel path — the Change Location surface sets the current location directly. With the Map (the player-facing readonly twin of the Locations Canvas) exposing connection arrows during play, the two paths now sit side by side: the player sees the travel structure while clicking anywhere they like.

## Decision

Player-initiated travel does **not** consult the effective destination set. Every location in the world is a valid player destination from anywhere, on both the List and the Map. The navigation rules exist to constrain the AI's world-consistency, not the player's agency.

## Consequences

- The Map renders arrows it does not enforce for player clicks — deliberate, not an oversight. Arrows describe how the *world* is wired for the narrator, not what the player may click.
- Player travel stays a silent instant state set: no turn, no narration, no destination validation.
- If travel restrictions ever extend to players, every player travel surface (List, Map, and any future one) must gate on the same effective-destinations computation the router uses — a product decision requiring its own UX for locked destinations, not a code toggle.

## Alternatives rejected

**Gate the player on effective destinations now**: consistent with the AI, but turns a navigation aid into a walking simulator — multi-hop travel through a large world becomes click-chains, and nothing in the game's design yet rewards that friction.

**Hide arrows from the player Map**: avoids the "why can I ignore these?" question, but discards the map's main information content; the structure is worth seeing even when it doesn't bind.
