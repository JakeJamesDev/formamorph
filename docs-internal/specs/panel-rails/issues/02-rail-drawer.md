# 02: Rail Drawer

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rulings: Q5, Q10, prototype verdict, and the spec's calls on drawer width and dialogs. Workload: outside-click and Escape handling across portaled dialogs, and the panels' tab selection.

## What to build

A rail icon opens its tab in a drawer over the narration, attached flush to the rail it came from. The drawer is as wide as the docked panel and shows the same content the docked panel shows for that tab. The open tab's rail icon is highlighted. Another icon on the same rail switches the drawer to its tab.

The drawer closes on a click outside it within the game view, on Escape, or on a second click on its icon. A dialog or popover opened from the drawer leaves it open, and Escape in that dialog closes only the dialog. Collapsing or docking a side closes its drawer.

This ticket owns the GameViewer path that opens the drawer on a given side and tab. Tickets 03 and 04 call it and don't add their own.

## Acceptance criteria

- [ ] Each rail icon opens the drawer on its tab, for both sides, and its icon shows as pressed.
- [ ] A second click on the open icon, Escape, and a click on the narration each close the drawer.
- [ ] A dialog opened from inside the drawer leaves it open. Escape closes the dialog first and the drawer second.
- [ ] Another icon on the open rail switches the drawer's tab without closing it.
- [ ] Docking a side while its drawer is open closes the drawer and shows the docked panel on the same tab.
- [ ] Frames `.scratch/frames/panel-rails-02-left.png` and `-right.png` at 1440×900, light and dark, show each drawer open.

For you: whether the drawer feels attached to its rail, opening a few tabs in game.
