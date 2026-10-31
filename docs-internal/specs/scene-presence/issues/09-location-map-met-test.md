# 09: Test the Met Set Through LocationMap

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The spec's testing decision says "The map runs through LocationMap's tests." Ticket 05 tested the Met map roster only through `metEntities`. Add LocationMap tests that render the map with a presence input and check what it draws.

## Acceptance criteria

- [x] A LocationMap test shows a Met entity at its position, and an unpositioned Met entity at each place it lists. (`LocationMap.test.tsx` "draws a Met entity at its position…")
- [x] A LocationMap test shows that a stranger is never drawn. ("never draws a stranger…")
- [x] Each test fails when its old behavior is put back. (Met filter widened to all: stranger test red. `entitiesInPlay` skipped: position test red. Both restored.)
- [x] Decide whether `metRosterByLocation`'s `runtimePositions` anchor fallback is still needed now that `usePresence` gives runtime characters their recorded place (3ca2ae8df). Remove it if not. (Removed: a runtime character with no `locationId` has no anchor either, so the fallback never fired.)

## Landed

**Not verified**
- None. `GameViewer` no longer passes the anchors; checked by typecheck only, not in a browser.

**For you**
- None.
