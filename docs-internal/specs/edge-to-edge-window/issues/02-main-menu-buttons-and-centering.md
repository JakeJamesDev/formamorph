# 02: Main Menu Buttons And Centering

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rulings: Q6, Q7, Q15. Workload: bounded UI work, plus one measured layout change to the shared app bar.

## What to build

The main menu loses its hamburgers. At full width, Load Game and Settings are direct round buttons after the view toggle. Once the bar folds, the action buttons, Load Game and Settings share one right-side `...`. There's no menu in the center of the bar.

Backup & Restore moves to the Settings Data tab and opens over Settings. The Take Me There target and the docs follow it.

Header items center on the full window, and move off center only when they would otherwise hit something. The main menu's buttons center exactly at full width. The World Editor's search centers once it fits, and below that it shrinks and stays as close to center as the right-side controls allow.

The room for the window buttons sits in the right-hand cell, so the side cells stay equal. The prototype's World Editor column cap is tuned to its current controls. Measure the right-side controls instead, so Advanced mode and later changes keep working.

## Acceptance criteria

- [x] At 1600 wide, and at any width where both sides have room, the main menu buttons center within 1px of the window center. Where they don't, they sit as close to center as the row allows, without touching the tabs. (e2e `window-chrome` web: centered at 1600 and 1920; at 1280 the row sits exactly the bar's 8px gap from the tabs.)
- [x] Entering and leaving full screen doesn't move the main menu buttons' center relative to the window. Ticket 06 removes the reserved room, so check this against the window center at each size. (e2e Electron: centered at 1600, in full screen, and back at 1600.)
- [x] Below the fold width, the bar shows the view toggle and one right-side `...` holding the action buttons, Load Game and Settings. (e2e "folds into one right-side menu" at 900: no direct Load Game, no Menu button, More right of the toggle, all five items in it.)
- [x] Load Game and Settings each open in one click at full width. (e2e at 1600, each dialog visible after one click.)
- [x] The fold logic subtracts the room held for the window buttons, and a guard fails when that subtraction is removed. Ticket 01 lands both, so keep them working through the new buttons. (`useHeaderFold.test` "folds sooner by the room held for the window buttons" stays green with the new measured parts.)
- [x] Backup & Restore opens from the Settings Data tab, over Settings. (e2e web, and `MainMenu.surfaceRequest.test` row test; main menu only per Q24, guarded by the `GameViewer.surfaceRequest.test` absence test, which went red with the gate removed.)
- [x] Take Me There reaches Backup & Restore at its new location. (`MainMenu.landing.test` lands on Restore with Settings Data below; `MainMenu.surfaceRequest.test` closes it back to `settings.data`.)
- [x] With the World Editor in Simple and Advanced mode, its search centers within 1px wherever both sides have room, measured at 1690 wide and in full screen. (e2e web and Electron, both modes; went red at 1280, 24px off, with the old columns reinstated.)
- [x] Below that width, the search keeps at least 10rem, and no controls overlap down to 1000 wide. (e2e at 1440, 1280, 1100, 1000, both modes.)
- [x] Web layout matches desktop apart from the room for the window buttons. (e2e Electron vs Chromium at 1600: tabs and action center within 1px, Settings shifted by the room less the 8px gap.)
- [x] Frames in `.scratch/frames/`: `menu-full.png`, `menu-narrow.png`, `settings-backup.png`, `editor-search.png`, each in both themes. (Plus `settings-backup-open` with the dialog over Settings.)
- [x] The Backup row's copy follows the Writing Guide. (Checked by hand against the help-line test; `settingsCopy.test` green. The `copy-sweep` skill was not run.)
- [x] Docs that name the old menu locations match, starting with Saves and Backup, Settings, Library and the help topics. (Saves-and-Backup, Settings, Library, Avatars, Design-System; help topics and Take Me There targets had no old-location text.)

For you: judge the main menu's look with direct Load and Settings buttons.

## Landed

**Not verified**

- Nothing in the criteria. The Windows hover rectangle and Snap Layouts over the new buttons stay unchecked, as the spec notes.

**For you**

- Judge the main menu's look with direct Load and Settings buttons: `.scratch/edge-to-edge-window-02/frames/menu-full-dark.png` and `menu-full-light.png`. The round buttons are 40px, down from the old 48px cog.
- At 1280 the full tabs push the action buttons about 69px right of center (Q23 keeps it): `.scratch/edge-to-edge-window-02/frames/settings-backup-dark.png` shows the bar at 1280.
- The narrow **More Actions** menu: `.scratch/edge-to-edge-window-02/frames/menu-narrow-dark.png`.
- Backup & Restore over Settings: `.scratch/edge-to-edge-window-02/frames/settings-backup-open-dark.png`.
- The World Editor search at 1690: `.scratch/edge-to-edge-window-02/frames/editor-search-light.png`.
