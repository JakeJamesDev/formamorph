# 07: Remaining Window Button Clearance

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rulings: Q3, Q20, Q21. Workload: an audit across dev-routes, then small layout fixes on top of ticket 01's tokens.

## What to build

No player can lose a control under the window buttons, on any Surface or popup. Ticket 01 clears five Surfaces. This ticket clears the rest, starting with Avatar Customization, whose right-side card scrolls under the buttons, and Formaquestion's full sheet.

Tall dialogs can also place their close button under the window buttons in a small window. Each dialog keeps its close button clear of them. The popup title bar sweep owns the alignment of those title bars, so check where it stands before changing them, and agree who changes each shared file.

Ticket 01's Landed section names what it saw. Use its header tokens and add no new ones. Only the desktop flag adds this room, so web and the macOS and Linux builds don't change.

## Acceptance criteria

- [x] An audit of every player Surface and modal in the dev-router, at 1280 and 800 wide in the Windows desktop app, lists each control under the window buttons. The result goes in this ticket's Landed section. a throwaway Electron spec ran all 86 routes at both sizes; the list is under Landed.
- [x] After the fixes, a repeat of the audit finds no control under the window buttons, including while scrolled. the repeat flags only the exempt Design System page and the dev-only Body Layout pane; scroll regions were flagged by box, not by overflow.
- [x] At 800×600, a full-height dialog's close button sits clear of the window buttons and stays clickable, confirmed by a native hit test. e2e `a full-height dialog keeps its close button clear of the window buttons at 800x600`, on Settings.
- [x] A guard for one fixed Surface and one dialog fails when its room is removed. e2e Avatar Customization and the dialog test each failed with their room removed.
- [x] Web layout is unchanged, confirmed by frames at 1280 wide. e2e `keeps the Avatar card and the tall dialogs where they were` in Chromium, plus frames `web-avatar-1280.png` and `web-dialog-1280.png`.
- [x] Frames in `.scratch/frames/`: `clearance-avatar.png`, `clearance-help.png`, `clearance-dialog.png`, each in both themes. stored as `-dark` and `-light`, at 800×600.

For you: open the tallest popups in a half-screen window and judge how they fit.

## Landed

**Audit before the fixes** (1280×800 and 800×600, Windows desktop app, every dev-route)

- Dialog close buttons at 800×600: Settings, the in-game Entity dialog, Profile, Formaquestion Settings, Formaquestion AI Context, Event Form, Podium, Feedback Form, Feedback Edit, Font Tune and Reveal Demo. Settings and Entity also had the Mode select under the buttons.
- Formaquestion AI Context's close button also sat under them at 1280×800.
- The supporter road scene scrolled its text under the buttons at 800 wide.
- Avatar Customization's right card scrolled its controls under the buttons.
- The Design System page and the Body Layout dev pane reach the top edge. Both are dev-only and exempt (Q21).

**Audit after the fixes:** only those two dev-only pages remain. A few dialog routes read as under the buttons in one pass and clear in the next, because the open animation scales the box for about 200ms. A single re-run of each was clean.

**Fixes:** a centered dialog never rises above the header line and keeps its size (`dialog.tsx`). A dialog that places itself, such as a full-height shell, keeps its place. Avatar Customization's card and the road's scroll area start below the line.

**Formaquestion's full sheet:** it exists only below 768px wide, and the desktop window can't go below 800. No change.

**The popup title bar sweep:** no session for it was running, and this ticket changes no title bar. It only moves the dialog box.

**Not verified**

- None. Every criterion above is ticked.

**For you**

- For you: open the tallest popups in a half-screen window and judge how they fit.
- Frames: `.scratch/edge-to-edge-window-07/frames/clearance-dialog-dark.png` and its siblings. Page captures don't show the native buttons.
