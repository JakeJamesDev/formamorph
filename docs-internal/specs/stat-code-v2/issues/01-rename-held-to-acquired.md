# 01: Rename Held To Acquired

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

A mechanical vocabulary rename with a glossary entry. Five identifiers and about two dozen comment lines in the trait runtime and the game view; the persisted field is untouched. Sonnet handles a rename with a typecheck gate well.

## What to build

The trait code says "acquired" where it now says "held". A trait the player chose at creation or took in play is *acquired*; one that is acquired but switched off is still acquired. The word matches the turn log, which already says "Acquired trait". The glossary gains an **Acquired** entry beside the Placeholder terms so the sandbox surface in later tickets uses a defined word.

## Acceptance criteria

- [ ] No identifier, parameter, or local in the trait runtime or the game view uses "held" for an acquired trait
- [ ] TSDoc and comments in the trait runtime and the game view use "acquired"
- [ ] The glossary defines **Acquired** with an _Avoid_ line listing "held"
- [ ] The save shape is unchanged
- [ ] Four gates green

## Blocked by

- None — can start immediately
