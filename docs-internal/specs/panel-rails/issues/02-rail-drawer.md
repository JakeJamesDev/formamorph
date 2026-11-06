# 02: Rail Drawer

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rulings: Q5, Q10, prototype verdict, and the spec's calls on drawer width and dialogs. Workload: outside-click and Escape handling across portaled dialogs, and the panels' tab selection.

## What to build

A rail icon opens its tab in a drawer over the narration, attached flush to the rail it came from. The drawer is as wide as the docked panel and shows the same content the docked panel shows for that tab. The open tab's rail icon is highlighted. Another icon on the same rail switches the drawer to its tab.

The drawer closes on a click outside it within the game view, on Escape, or on a second click on its icon. A dialog or popover opened from the drawer leaves it open, and Escape in that dialog closes only the dialog. Collapsing or docking a side closes its drawer.

This ticket owns the GameViewer path that opens the drawer on a given side and tab. Tickets 03 and 04 call it and don't add their own.

## Acceptance criteria

- [x] Each rail icon opens the drawer on its tab, for both sides, and its icon shows as pressed. Tests "opens each left rail icon…" and "opens each right rail icon on its tab".
- [x] A second click on the open icon, Escape, and a click on the narration each close the drawer. Test "closes on a second click on its icon, on Escape, and on a click on the narration".
- [x] A dialog opened from inside the drawer leaves it open. Escape closes the dialog first and the drawer second. Test "stays open under a dialog…" (the Location dialog).
- [x] Another icon on the open rail switches the drawer's tab without closing it. Left-rail test loop; the drawer's own tab strip moves the highlight too ("moves the rail highlight…").
- [x] Docking a side while its drawer is open closes the drawer and shows the docked panel on the same tab. Test "docks from its strip onto the drawer's tab, on each side" (T02-3 strip on the drawer's edge).
- [x] Frames `.scratch/frames/panel-rails-02-left.png` and `-right.png` at 1440×900, light and dark, show each drawer open. Playwright on the whiteRoom fixture; `-dark` twins beside them.

For you: whether the drawer feels attached to its rail, opening a few tabs in game.

## Landed

**Not verified**

- Escape with a Base UI tooltip or a non-Radix menu open inside the drawer. The drawer yields only to an Escape that a layer cancels (Radix does). A layer that doesn't cancel it closes along with the drawer.

**For you**

- For you: whether the drawer feels attached to its rail, opening a few tabs in game. Frames: `.scratch/panel-rails-02/frames/panel-rails-02-left.png`, `-right.png`, and their `-dark` twins.
- The strip's grip on the drawer's inner edge, over the narration (`-left.png`, x≈446).

**Calls made while building**

- Hide UI also closes the drawer, so Show UI brings back the rails with no drawer open.
- The docked left panel now reopens on the tab it last showed after a collapse and dock, not on Notes. That is what lets docking from the drawer keep its tab. Mobile is unchanged.
- While the right drawer is open, two RightPanel instances mount: the rail and the drawer. Ticket 03's dots should hook into GameViewer, not into panel effects.

**Follow-ups named in review**

- A Surface request into a collapsed left side still targets only the docked panel. Ticket 04 owns that path through `openDrawer`.
- `docs/Design-System.md` has no entry for the panel drawer. It was approved as prototype variant B.
