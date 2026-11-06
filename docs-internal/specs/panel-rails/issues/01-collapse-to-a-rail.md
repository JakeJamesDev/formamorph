# 01: Collapse To A Rail

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rulings: Q1, Q2, Q3, Q4, Q6, Q7, Q9, Q12, Q14, prototype verdict. Workload: GameViewer layout, a new per-device prefs module and the god-node's desktop row.

## What to build

On desktop, each side panel in game collapses on its own to a labeled rail of its tab icons. A thin toggle strip on the panel's inner edge collapses it. The same strip on the rail's inner edge docks it again. The strip shows a grip line at rest and a chevron on hover and focus, with a "Collapse Panel" or "Dock Panel" tooltip. The chevrons in the left panel's top row and the header go away.

The left rail shows Back and Music at its top, then Entities, Notes, Memory and Logs. The right rail shows Stats, Traits, Inventory and Location, with no clock or persona row. The right strip and rail start below the header line.

The narration keeps a reading width and stays centered in the space between the sides, docked or collapsed. Each device remembers which sides are collapsed. Both default to docked. Hide UI hides the rails and strips, and Show UI brings them back as they were. Mobile is unchanged.

The rail icons render here, with their labels. Ticket 02 makes them open the drawer. This ticket owns the rail, the edge toggle and the panel layout prefs. Later tickets build on them.

The prototype on `prototype/panel-rails` (variant B, commit a8cb9acd0) shows one working version. Build from main.

## Acceptance criteria

- [ ] Each side collapses and docks through its edge strip, independently. The strip's accessible name is "Collapse Panel" when docked and "Dock Panel" when collapsed.
- [ ] The strip is reachable with Tab and works with Enter and Space.
- [ ] The left rail shows Back and Music, then Entities, Notes, Memory and Logs with labels. Back still asks before leaving. Music still toggles.
- [ ] The right rail shows Stats, Traits, Inventory and Location with labels, and no clock or persona row.
- [ ] The collapsed state survives a remount on the same device, and a fresh device starts with both sides docked.
- [ ] Hide UI hides both rails and strips. Show UI restores the state from before.
- [ ] The mobile layout shows no rail or strip.
- [ ] Frames `.scratch/frames/panel-rails-01-docked.png`, `-left.png`, `-right.png` and `-both.png` at 1440×900, light and dark, show the reading width, centering and the right strip below the header line.
- [ ] The new labels pass the Writing Guide, and the changelog fragment names the feature.

For you: the strip's width and the grip line's look on a real monitor, in game with both sides collapsed.
