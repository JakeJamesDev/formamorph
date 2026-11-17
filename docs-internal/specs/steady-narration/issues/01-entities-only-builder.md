# 01: Entities-Only Player View Builder

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The prefactor (spec, Implementation Decisions, Q4). The Player View module exports a builder that returns only the entity rows. The full Player View builder calls it, so there is one code path. Nothing calls the new builder yet, so play is unchanged.

- Its inputs are the entity-relevant state only: discovered entities, entity positions, generic and unique states, the current location, the met list, stranger aliases, the visible-entity records of the chain's saved states and of the current state, the world's entities, locations and connections, the persona, the resolver, the entity-on check, and the gate.
- It takes the chain's visible-entity records, not full saved states, so ticket 02 can feed it without the save-state getter.

## Acceptance criteria

- [x] The full Player View builder gets its entity rows from the new builder. `buildPlayerView` calls `buildPlayerViewEntities`.
- [x] For every fixture in the existing Player View tests, unidentified entities included, the new builder returns the same rows as the full builder. The `view` helper in `playerView.test.ts` asserts it on every call; affected tests green.
- [x] The new builder reads no history, choices, log, page or notes. Its input type does not hold them. Typecheck green.

## Landed

**Not verified**
- None.

**For you**
- Nothing. Play is unchanged and nothing calls the new builder yet.
