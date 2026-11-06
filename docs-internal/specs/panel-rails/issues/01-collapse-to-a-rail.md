# 01: Collapse To A Rail

Status: ready-for-human
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

- [x] Each side collapses and docks through its edge strip, independently. The strip's accessible name is "Collapse Panel" when docked and "Dock Panel" when collapsed. (`GameViewer.panelRails.test.tsx`: "collapses to its rail and docks again", right-side twin)
- [x] The strip is reachable with Tab and works with Enter and Space. (test "works from the keyboard"; native button, focused then Enter and Space)
- [x] The left rail shows Back and Music, then Entities, Notes, Memory and Logs with labels. Back still asks before leaving. Music still toggles. (tests "collapses to its rail…", "keeps Back asking…")
- [x] The right rail shows Stats, Traits, Inventory and Location with labels, and no clock or persona row. (tests "collapses to the tabs its panel shows…" and "leaves Stats off the rail…"; Inventory follows the docked panel's own condition)
- [x] The collapsed state survives a remount on the same device, and a fresh device starts with both sides docked. (tests "survives a remount…", "starts docked on a fresh device")
- [x] Hide UI hides both rails and strips. Show UI restores the state from before. (test "hides with Hide UI…")
- [x] The mobile layout shows no rail or strip. (test "shows no rail or strip on mobile…", both mobile tabs opened)
- [x] Frames `.scratch/frames/panel-rails-01-docked.png`, `-left.png`, `-right.png` and `-both.png` at 1440×900, light and dark, show the reading width, centering and the right strip below the header line. (Playwright frames; DOM read: card 896px, centered 132/132 one side, 272/272 both; right strip top at 56px)
- [x] The new labels pass the Writing Guide, and the changelog fragment names the feature. (Title Case labels; fragment `panel-rails-01.md`)

For you: the strip's width and the grip line's look on a real monitor, in game with both sides collapsed.

## Landed

**Not verified**

- The window drag band over a collapsed right rail in the desktop app. DOM read only: the band spans the header line above the rail; not tried in Electron.

**For you**

- The strip's width and the grip line's look on a real monitor, in game with both sides collapsed. Frames: `.scratch/panel-rails-01/frames/panel-rails-01-both.png` and `-both-dark.png`.
- The edge Help tab overlaps the right rail's outer edge by about 16px (`-both.png`). It overlapped the docked panel the same way before.
- Dragging the desktop window from above the collapsed right rail.

**Follow-ups named in review**

- `docs/Design-System.md` has no entry for the panel rail or edge strip; its Nav Rail section describes a different pattern.
- No dev-route opens the game with a side collapsed; frames set the device prefs instead.
