# 04: Landing Into A Collapsed Side

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rulings: Q11. Workload: one branch in the GameViewer Surface landing, on ticket 02's drawer path.

## What to build

When Take Me There, a tutorial step or a dev-route targets a tab on a collapsed side, the drawer opens on that tab and the request lands its row there. A target on a docked side behaves as today. The help window and tutorial code need no change.

## Acceptance criteria

- [x] A Surface request for a right-side tab with the right side collapsed opens the drawer on that tab. (GameViewer.panelRails.test: "opens the right drawer on the requested tab")
- [x] A Surface request for a left-side tab with the left side collapsed opens the drawer on that tab. ("opens the left drawer on the requested tab")
- [x] A repeat request for the same tab opens the drawer again after it was closed. ("opens the drawer again for a repeat request")
- [x] A request into a docked side selects the tab, with no drawer. The docked right side did not select before this ticket (T04-1). ("selects the tab in a docked panel")

## Landed

**Not verified**
- Dev-route landing into a collapsed side: not exercised. The dev-router has its own path that does not go through `openSurfaceHere`.

**For you**
- Press Take Me There from the help window for a Stats or Memory topic with that side collapsed. The drawer should open on the tab.
