# 05: Gated Opening Fallback

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: one call site and one test; the gate pick already exists.

## What to build

A save with no stored opening placement rebuilds its opening cast with Routine gates, as every other Sample Placement does.

- `openingPlacesOf` falls back to Sample Placement with the ungated pick, so it reads the first Routine (spec Q18: "Sample Placement uses the first Routine whose gate holds at the authored start").
- Pass the start gate pick (the one the other Sample Placement callers use) into that fallback.
- Found by the spec close review. Only saves written before opening placements were stored reach it.

Spec rulings: Q18.

## Acceptance criteria

- [x] A test: a save with no opening placement, for an entity whose first Routine's gate fails at the start, places it from the Routine that holds. The guard bites with the ungated pick reinstated. (`openingPlacement.test.ts`; failed with the pick dropped from the fallback, passes with it.)

## Landed

**Not verified:** nothing open. The GameViewer call site has no render test; typecheck covers its types.

**For you:** nothing a player must judge.
