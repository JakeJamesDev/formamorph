# 07: Remaining Window Button Clearance

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rulings: Q3, Q20, Q21. Workload: an audit across dev-routes, then small layout fixes on top of ticket 01's tokens.

## What to build

No player can lose a control under the window buttons, on any Surface or popup. Ticket 01 clears five Surfaces. This ticket clears the rest, starting with Avatar Customization, whose right-side card scrolls under the buttons, and Formaquestion's full sheet.

Tall dialogs can also place their close button under the window buttons in a small window. Each dialog keeps its close button clear of them. The popup title bar sweep owns the alignment of those title bars, so check where it stands before changing them, and agree who changes each shared file.

Ticket 01's Landed section names what it saw. Use its header tokens and add no new ones. Only the desktop flag adds this room, so web and the macOS and Linux builds don't change.

## Acceptance criteria

- [ ] An audit of every player Surface and modal in the dev-router, at 1280 and 800 wide in the Windows desktop app, lists each control under the window buttons. The result goes in this ticket's Landed section.
- [ ] After the fixes, a repeat of the audit finds no control under the window buttons, including while scrolled.
- [ ] At 800×600, a full-height dialog's close button sits clear of the window buttons and stays clickable, confirmed by a native hit test.
- [ ] A guard for one fixed Surface and one dialog fails when its room is removed.
- [ ] Web layout is unchanged, confirmed by frames at 1280 wide.
- [ ] Frames in `.scratch/frames/`: `clearance-avatar.png`, `clearance-help.png`, `clearance-dialog.png`, each in both themes.

For you: open the tallest popups in a half-screen window and judge how they fit.
