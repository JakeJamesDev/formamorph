# 04: Landing Into A Collapsed Side

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rulings: Q11. Workload: one branch in the GameViewer Surface landing, on ticket 02's drawer path.

## What to build

When Take Me There, a tutorial step or a dev-route targets a tab on a collapsed side, the drawer opens on that tab and the request lands its row there. A target on a docked side behaves as today. The help window and tutorial code need no change.

## Acceptance criteria

- [ ] A Surface request for a right-side tab with the right side collapsed opens the drawer on that tab.
- [ ] A Surface request for a left-side tab with the left side collapsed opens the drawer on that tab.
- [ ] A repeat request for the same tab opens the drawer again after it was closed.
- [ ] A request into a docked side selects the tab as today, with no drawer.
