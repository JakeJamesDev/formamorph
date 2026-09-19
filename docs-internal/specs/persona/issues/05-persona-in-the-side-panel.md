# 05: Persona in the Side Panel

Status: ready-for-human
Base: 759e80df
Blocked by: 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Persona](../spec.md)

**What to build:** The game's side panel shows the current persona's portrait and name beside Notes and Traits, with a Change control that opens the same picker as Enter World. A save made before this feature can take a persona this way. A save whose persona is missing from the library runs with none and shows one notice.

**Rationale for the model:** a panel row, a reused picker, and one notice, all on existing patterns. A mid-tier model at medium effort fits.

## Acceptance criteria

- [x] The row shows the portrait and name, or a None state, and sits with the player's own data.
- [x] Change opens the picker from ticket 04. A pick rewrites the save's reference. The one-role rule holds against the characters added to that playthrough.
- [x] A save with no reference shows the None state and can take a persona.
- [x] A reference that no longer resolves gives no persona and raises one notice per load, never one per turn. Only a deleted or absent entity counts. An entity that lost its Persona mark still resolves and raises no notice.
- [x] The row shows a current persona that has lost its mark, although the picker no longer offers it. A Change away from it cannot be undone from the picker until the mark is set again. A test covers this state.
- [x] A change updates the world's remembered pick.
- [x] Digests and diaries written before a change keep the earlier name. No re-attribution runs.
- [x] Tests run through the game panels harness: the row renders, a Change writes the reference, and the notice fires one time.
- [x] The picker is reachable in one dev-router call and is checked in the preview at a realistic viewport, with static DOM evidence.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section. Typecheck, lint and build pass. Tests: 9 failures remain, all in ticket 08's uncommitted Player Name chip plus one flaky WorldEditor test; wall time 87 to 145 s under parallel-session load.

## Scope notes

The portrait appears nowhere else in the game. No export-shape change.
