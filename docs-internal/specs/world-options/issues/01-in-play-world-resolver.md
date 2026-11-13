# 01: In-Play World Resolver

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A prefactor. One pure In-Play World resolver takes the authored world and the playthrough state and returns the in-play view: which entities and locations are on, which locations are locked, and room for the Option pins and lock-line parts later tickets add. Today every entity and location is on and none is locked, so behavior does not change.

- Build the resolver as a deep module with a small interface. Later tickets add gates inside it; readers never learn how a gate works.
- Move the core in-play readers onto it: presence and the scene cast, routines and positions, Known In and reach, the AI context builders and chip values, the navigation graph and the router's candidate walk, and the new-game start pick.
- Add a reader-coverage parity harness: a test world plus a hook that lets a test mark one entity and one location as off in the resolver, then asserts neither appears in each covered reader's output. Ticket 02 extends it to every remaining reader.
- No changelog fragment: no player-visible change.

Spec rulings: Implementation Decisions (In-Play World resolver), Testing Decisions (reader coverage).

## Acceptance criteria

- [ ] The resolver has unit tests for today's world: every entity and location on, none locked.
- [ ] The parity harness, with one entity and one location forced off through the resolver, shows neither in presence, positions, Known In, the AI context, chip values, the router's candidates or the start pick.
- [ ] The guard bites: routing one covered reader back to the raw world turns its harness case red.
- [ ] Existing turn pipeline parity tests stay green with no fixture changes.
