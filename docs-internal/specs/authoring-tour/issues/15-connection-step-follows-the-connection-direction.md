# 15: Connection Step Follows the Connection Direction

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Authoring Tour](../spec.md)

**What to build:** On the Connection step, In Play shows the location that the tour Connection leaves from. Today it always shows the first tour location. After a one-way Connection from the second location to the first, that location's destinations list is empty.

| Tour Connection | In Play shows |
|---|---|
| Two-way | The first tour location |
| One-way, first → second | The first tour location |
| One-way, second → first | The second tour location |

The rule covers both Player Sees (Connected Locations in the Location tab) and the Location Change reader (the destinations list, with the Travel Hint marked).

**Rationale for the model:** one slice rule and its tests on an existing step. Sonnet at medium effort.

## Acceptance criteria

- [ ] In all three cases in the table, Player Sees and the Location Change reader show the same location, and its list names the other tour location.
- [ ] The Travel Hint is marked in every case where the author wrote one.
- [ ] If the author changes the Connection's direction during the step, In Play follows on the next render.
- [ ] Tests through the World Editor Bench harness cover all three directions. Prove the one-way guard by pinning In Play back to the first location and watching the test fail.
- [ ] Preview check through the dev router: a one-way Connection from the second location to the first, with static DOM evidence.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- The step's completion rule does not change. Any Connection between the two tour locations completes it.
- Build on `feature/authoring-tour` in the worktree.
