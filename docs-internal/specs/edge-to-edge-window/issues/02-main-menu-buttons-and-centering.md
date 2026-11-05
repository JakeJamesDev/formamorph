# 02: Main Menu Buttons And Centering

Status: ready-for-agent
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

- [ ] At 1280 and 1600 wide, the main menu buttons center within 1px of the window center.
- [ ] Entering and leaving full screen doesn't move the main menu buttons' center relative to the window. Ticket 06 removes the reserved room, so check this against the window center at each size.
- [ ] Below the fold width, the bar shows the view toggle and one right-side `...` holding the action buttons, Load Game and Settings.
- [ ] Load Game and Settings each open in one click at full width.
- [ ] The fold logic subtracts the room held for the window buttons, and a guard fails when that subtraction is removed.
- [ ] Backup & Restore opens from the Settings Data tab, over Settings.
- [ ] Take Me There reaches Backup & Restore at its new location.
- [ ] With the World Editor in Simple and Advanced mode, its search centers within 1px wherever both sides have room, measured at 1690 wide and in full screen.
- [ ] Below that width, the search keeps at least 10rem, and no controls overlap down to 1000 wide.
- [ ] Web layout matches desktop apart from the room for the window buttons.
- [ ] Frames in `.scratch/frames/`: `menu-full.png`, `menu-narrow.png`, `settings-backup.png`, `editor-search.png`, each in both themes.
- [ ] The Backup row's copy follows the Writing Guide.
- [ ] Docs that name the old menu locations match, starting with Saves and Backup, Settings, Library and the help topics.

For you: judge the main menu's look with direct Load and Settings buttons.
