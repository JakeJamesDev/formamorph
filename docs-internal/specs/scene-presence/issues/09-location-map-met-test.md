# 09: Test the Met Set Through LocationMap

Status: needs-triage
Blocked by: None (can start immediately)

## What to build

The spec's testing decision says "The map runs through LocationMap's tests." Ticket 05 tested the Met map roster only through `metEntities`. Add LocationMap tests that render the map with a presence input and check what it draws.

## Acceptance criteria

- [ ] A LocationMap test shows a Met entity at its position, and an unpositioned Met entity at each place it lists.
- [ ] A LocationMap test shows that a stranger is never drawn.
- [ ] Each test fails when its old behavior is put back.
- [ ] Decide whether `metRosterByLocation`'s `runtimePositions` anchor fallback is still needed now that `usePresence` gives runtime characters their recorded place (3ca2ae8df). Remove it if not.
