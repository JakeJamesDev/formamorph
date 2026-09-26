# 05: Persona starting location

Status: ready-for-human
Base: 1f88d078
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: one new field through an existing pick seam and two small UI surfaces, with persona pick tests as prior art.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

An author names where a world persona begins. The player who picks that persona sees the location preselected, can still change it, and reads "Starts at …" in the persona picker before choosing.

## Acceptance criteria

- [ ] A world entity with the Persona mark gains an optional starting location id. This is an additive world export change.
- [ ] The entity editor shows a Starting Location select for a world persona: Automatic first, then every location, flagged or not.
- [ ] The persona picker shows "Starts at …" under a persona with a starting location.
- [ ] Picking the persona preselects that location through the existing persona location pick, which prefers the explicit field and falls back to today's first-flagged rule on Automatic.
- [ ] The Starting Location step lists an unflagged location only while the persona that names it is picked. A switch to a persona that does not name it drops the selection back to the automatic pick. The player can change the preselection at any time.
- [ ] Persona pick tests cover: explicit field wins, Automatic falls back, an unflagged location is offered while its persona is picked, a switch away drops it.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
