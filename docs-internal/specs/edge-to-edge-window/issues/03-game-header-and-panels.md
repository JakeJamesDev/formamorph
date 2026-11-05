# 03: Game Header And Panels

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rulings: Q6, Q8, Q9, Q10, Q12, Q18. Workload: bounded UI work in the game Surface's largest component.

## What to build

In game, the left and center panels reach the top margin, so they gain 40px of height. The right column stays below the header, and on desktop it has a 312px minimum width so the header's buttons never reach the center panel.

The header's right side reads `Save | Load`, Settings, `...`. Save and Load are one two-segment pill, and each half opens its own dialog in one click. `...` holds Edit World, AI Context and Send Feedback.

The left panel's top row reads Back at the left, then Music and the Entity View chevron at the right. All three use the panel's outlined icon style, with no title in the row. Back opens the existing exit confirmation. Music off shows the double note with a slash, in the muted color. An 8px gap separates the row from the entity image.

In the game Surface, only the top margin and the space above the right column drag the window, so panel text stays selectable.

Mobile keeps its single menu, with Save Game, Load Game, Edit World, AI Context, Settings, Send Feedback and Exit. Only its icon changes to `...`.

Add the two-segment button to the Design System, since the owner approved it in the prototype.

## Acceptance criteria

- [x] On desktop and web, the left and center panels start at y=16, and the right column starts at y=56. e2e `game: panels rise` reads the numbers in Electron. Web uses the same classes; the Chromium run checks its header line only.
- [x] At 1280, 1000 and 800 wide on desktop, the header's buttons stay above the right column and clear of the center panel. e2e `game: panels rise`; a 0px minimum fails it at 1000.
- [x] Save and Load each open their own dialog in one click, and a test save appears in the Load list. `GameViewer.headerActions.test.tsx`; e2e `game-header.spec.ts`.
- [x] Loading a save from the Load half reaches a loaded game. e2e `game-header.spec.ts`: a later turn is gone after the load.
- [x] Settings opens in one click, and `...` holds Edit World, AI Context and Send Feedback when signed in. `GameViewer.headerActions.test.tsx`.
- [x] Back opens the exit confirmation, and Cancel keeps the game running. `GameViewer.headerActions.test.tsx`; leaving directly fails it.
- [x] Music on and off show different icons, with the muted color on off, and the button's accessible name follows its state. `GameViewer.headerActions.test.tsx`; frames `game-left-row-music-off-*`.
- [x] A native hit test reports caption on the top margin and above the right column, and client on panel content below the margin. e2e `game: drags`; removing either drag rule fails it.
- [x] Toasts still start below the header. e2e `starts a top-right toast below the header`, on the main menu in Electron and Chromium. The rule is global, and this ticket doesn't touch it.
- [x] Mobile keeps its full menu, confirmed by a frame at 375 wide. Frame `game-mobile-375.png`; `GameViewer.headerActions.test.tsx` for the order, with Send Feedback signed in.
- [x] Frames in `.scratch/frames/`: `game-header.png`, `game-left-row.png`, `game-800.png`, each in both themes. Stored as `-dark` and `-light`.
- [x] The two-segment button appears in the Design System showcase. DOM read at `modal=designSystem`: both halves render, and a click reports its half.
- [x] Tooltip and menu copy follows the Writing Guide. Read against the guide: Title Case labels. `More Actions` matches the help window's name for its menu.
- [x] Docs that name the old game menu match. How to Play, Saves and Backup, Settings, Feedback, Home. The `Menu` in Library and Avatars is the main menu's, which is ticket 02's.

For you: play a turn in a real world and judge the left panel row over your own entity art.
For you: judge the step between the raised panels and the right column.

## Landed

**Not verified**

- None. Every criterion above is ticked. The panels' y=16 and y=56 were read in Electron only.

**For you**

- For you: play a turn in a real world and judge the left panel row over your own entity art.
- For you: judge the step between the raised panels and the right column.
- Frames: `.scratch/edge-to-edge-window-03/frames/game-header-dark.png`, `game-left-row-dark.png`, `game-800-dark.png` and their `-light` twins. Page captures don't show the native buttons.

**Also seen**

- The left panel row centers near y=41, not y=28, because it sits inside the raised panel. The e2e header-line check now starts at Save Game.
- The chevron icon stays 16px beside the 20px Back and Music icons, as in the prototype. Ticket 04 owns the chevron.
