# Edge-to-Edge Window

Status: ready-for-agent
Spec session: edge-to-edge-window — spec

## Problem Statement

The desktop app runs inside a standard Windows title bar. The bar takes height from every Surface and doesn't match any theme or world art.

The top of the app also has no shared structure. Each Surface places its top row at its own height, so nothing lines up. The hamburger menus hold actions instead of navigation, and they hide common actions like Save and Settings behind an extra click. In game, the left and center panels lose height to a button row above them.

## Solution

Content reaches the top edge of the window, and Windows draws only its minimize, maximize and close buttons over it. Every top row shares one 56px header line. Primary actions become direct buttons, and everything else moves to a right-side `...` menu. The left and center panels in game reach the top.

In full screen, the window buttons go away and the room saved for them goes too, so the app lays out as it does in a browser.

## User Stories

1. As a desktop player, I want content to reach the top of the window, so that the game uses the whole window.
2. As a desktop player, I want the real Windows window buttons, so that they behave as they do in other apps.
3. As a desktop player, I want the Snap Layouts menu on the maximize button, so that I can arrange windows as usual.
4. As a desktop player, I want to drag the window by the empty parts of the header, so that moving it still works without a title bar.
5. As a desktop player, I want every control in the header to stay clickable, so that dragging never swallows a click.
6. As a desktop player, I want the window buttons to match my theme, so that they stay readable in light and dark.
7. As a desktop player, I want the window buttons to stay readable over bright or dark world art, so that I can always find them.
8. As a desktop player, I want the window buttons to fade with the page behind a popup, so that they don't stick out.
9. As a desktop player, I want the window buttons at full strength over a full-window dialog, so that they don't look disabled there.
10. As a player, I want every top row centered on one line, so that the app reads as one consistent header.
11. As a player, I want no control under the window buttons, so that I can reach all of them.
12. As a player, I want toasts below the header, so that they don't collide with the header's buttons.
13. As a player, I want centered header items centered on the whole window, so that they line up with the content below.
14. As a player, I want header items to hold their place entering and leaving full screen, so that nothing jumps.
15. As a player, I want the main menu's Load Game and Settings as direct buttons, so that each takes one click.
16. As a player in a narrow window, I want the main menu's actions in one right-side `...` menu, so that the bar still fits.
17. As a player, I want Backup & Restore in the Settings Data tab, so that it sits with my other data controls.
18. As a player in game, I want a back button at the top left, so that leaving a game is where I expect it.
19. As a player in game, I want the exit confirmation on that back button, so that one click can't lose my progress.
20. As a player in game, I want Save and Load as one two-part button, so that each takes one click and they read as a pair.
21. As a player in game, I want Settings as a direct button, so that I can reach it from play.
22. As a player in game, I want Edit World, AI Context and Send Feedback in a `...` menu, so that they stay available without crowding the header.
23. As a player in game, I want the left and center panels to reach the top, so that they have more room.
24. As a player in game, I want the left panel's top row to read as one group, so that Back, Music and the Entity View toggle look like they belong together.
25. As a player in game, I want no title above the entity image, so that nothing reads as the image's name.
26. As a player in game, I want a separate icon for music off, plus the fade, so that its state is clear at a glance.
27. As a player in game, I want the Entity View to slide while its chevron turns, so that I can see where the image went.
28. As a player who prefers reduced motion, I want that change to happen at once, so that nothing animates.
29. As a desktop player in full screen, I want the header to use the room the window buttons held, so that no empty gap remains.
29a. As a desktop player in full screen, I want an Exit Full Screen item in the `...` menu, so that I can leave without knowing F11.
29b. As a desktop player, I want to shrink the window to half of a 1080p screen and no further, so that I can snap it without breaking the layout.
30. As the owner, I want full-screen desktop and browser layouts to stay matched, so that I don't maintain two layouts.
31. As the owner, I want a test that fails when they drift apart, so that drift can't return unnoticed.
32. As a player browsing Community Creations, I want its sort and refresh controls clear of the window buttons, so that I can use them.
33. As an author in the World Editor, I want the search centered when it fits, so that the header looks balanced.
34. As an author in a full screen editor, I want its controls clear of the window buttons, so that I can use them.
35. As a player reading the docs, I want them to name the new locations, so that I can find what moved.

## Implementation Decisions

The owner settled these in the prototype session. A ruling reopens on new evidence, never on a new opinion.

### Rulings

- **Q1. Native window buttons.** Hide the title bar and keep Windows' own buttons through Electron's Window Controls Overlay. We don't draw our own buttons.
- **Q2. Edge to edge.** Content reaches the top edge, instead of sitting below a thin themed strip.
- **Q3. One header line.** The window buttons are 56px tall, and every top row centers on y=28.
- **Q4. Corner legibility.** The window buttons have a transparent background. In game, a soft gradient sits above the location art and behind the panels and buttons. No other Surface needs it, because each has a solid background there. A dark panel and round buttons were both tried and rejected.
- **Q5. Popup dimming.** While a dimming layer reaches the window buttons, their symbols fade to white at 25%. A full-window dialog that covers the dimming layer keeps them at full color.
- **Q6. No hamburgers.** A hamburger means navigation. These menus hold actions, so they become a horizontal `...` at the right end of the bar.
- **Q7. Main menu.** At full width, Load Game and Settings are direct round buttons. Once the bar folds, the action buttons, Load Game and Settings share one right-side `...`. Backup & Restore moves to the Settings Data tab.
- **Q8. Game header, right side.** It reads `Save | Load`, Settings, `...`. Save and Load are one two-segment pill, and each half opens its own dialog. `...` holds Edit World, AI Context and Send Feedback. A combined dialog and a half-and-half icon were both tried and rejected.
- **Q9. Left panel row.** It reads Back at the left, then Music and the Entity View chevron at the right. All three use the panel's outlined icon style, because they sit inside a panel. The row has no title: a world name there read as the image's name.
- **Q10. Music icon.** On is the double note. Off is the same note with a slash, in the muted color. The slash and the fade together read best as off.
- **Q11. Chevron.** Up when expanded, down when collapsed. It turns while the section slides over 200ms on the nav rail's curve. The section clips at full size, and the entity view unmounts after the slide.
- **Q12. Game panels.** The left and center panels start at the top margin. The right column starts below the header, and the buttons above it read as its header. On desktop, the right column has a 312px minimum width, so those buttons never reach the center panel.
- **Q13. Toasts.** Top-right toasts start below the header line.
- **Q14. Full screen.** The window buttons go away in full screen, so the room saved for them goes too. Layout differences between desktop and web live in one place and hold only that room, so a full-screen window uses the browser layout.
- **Q15. Centering.** Centered header items center on the full window. They move off center only when they would otherwise hit something.
- **Q16. Web layout.** Web takes the same header line, lifted main menu bar, game header row and toast position as desktop. The two differ only by the room saved for the window buttons.
- **Q17. Leaving full screen.** While in full screen, an Exit Full Screen item shows in the `...` menu, and F11 keeps working. There's no extra header button. The game's `...` is always there. The main menu has no `...` at full width, so it shows one in full screen to hold this item. Other full-window Surfaces rely on F11 or on going back first.
- **Q18. Mobile.** Mobile keeps its single menu, with Save Game, Load Game, Edit World, AI Context, Settings, Send Feedback and Exit. Only its icon changes to `...`.
- **Q19. Minimum window size.** The desktop window's minimum content size is 800×600. This allows half-screen snapping on a 1080p display. The owner accepts that the World Editor's title cuts off and the game panels get cramped near that size.
- **Q20. Windows only.** The hidden title bar, window buttons, minimum size, corner gradient, symbol dimming and Exit Full Screen apply only on Windows. The macOS and Linux desktop builds keep the native title bar and use the web layout from Q16, because macOS puts its buttons on the left and we can't test either platform here.
- **Q21. Clearance beyond the five Surfaces.** Story 11 covers every player Surface and dialog. Ticket 01 covers the main menu, game Surface, World Editor, Community Creations and full screen editor. Ticket 07 covers the rest, including tall dialogs at small window sizes. The popup sweep owns title bar alignment, not clearance. The dev-only Design System page is exempt.
- **Q22. Full screen editor shell.** At `md` and wider, its content starts at y=56 on desktop and web, and its corner button sits on the header line. Web gives up 40px of editor height, so the two layouts stay one layout.
- **Q23. Main menu tabs and centering.** The bar still folds only when the whole row doesn't fit, and the buttons drift off center before anything folds. The library tabs keep their full labels while the row fits. At 1280 wide, the buttons sit about 68px right of center. They center exactly wherever both sides have room.
- **Q24. Backup & Restore in game.** The Settings Data row shows only in main menu Settings. Restore reloads the app, which would drop a running game, so Take Me There from a game still asks to exit first.

### Modules

- **Electron shell.** On Windows, creates the hidden title bar and overlay, sets the minimum window size, accepts a symbol color from the page, reports full-screen state to the page, and leaves full screen on request.
- **Window chrome module (new).** Owns the desktop flag, the theme and dimming symbol color, and the drag area. The flag is set only on Windows. It replaces the prototype's throwaway module.
- **Global layout tokens.** Shared values for the header line, plus the desktop-only room for the window buttons.
- **Main menu top bar and its header fold.** The fold logic subtracts the room held for the window buttons.
- **Shared Surface app bar.** Used by the World Editor.
- **Game panels and game Surface.** The left panel row, the raised panels, the gradient and the right column.
- **Game menu.** The direct buttons and the `...` contents on desktop, with the full menu kept for mobile.
- **Settings Data tab.** Gains the Backup & Restore entry.
- **Community Creations header and the full screen editor shell.** Both clear the window buttons.

### What the prototype learned

- **The overlay's reported size doesn't change in full screen.** Electron's overlay reports 56px and visible there, so the page can't read full screen from it. The main process has to tell the page.
- **A host can define the same CSS values.** The Browser pane reported a 36px title bar height from its own window, so `env()` fallbacks aren't enough to protect web. The desktop flag must gate them.
- **Native buttons always paint above the page.** No z-index can lift a toast or dialog over them, so anything in that corner has to move.
- **Drag rules are easy to over-apply.** A no-drag rule on every element with a role also removes dragging whenever a dialog is open, because a dialog has a role. Keep the list to controls. Elements that only look clickable and aren't real controls need a check.
- **Check drag and buttons through the native hit test.** Playwright's clicks skip the native layer, so they can't prove a click reaches the page. `WM_NCHITTEST` reports caption, client and each window button directly.
- **Flex grows from padding.** Padding on the right cell keeps the side cells unequal, so the main menu's room is a spacer child.
- **Grid needs a capped middle column.** A middle `1fr` column keeps the side columns unequal even when the search fits. The prototype's cap is tuned to the World Editor's current controls. The real build should measure the end cell instead.
- **The dimming check has to rerun after animations end.** A dialog covers its dimming layer only after it opens, and a check made too early leaves the symbols dim.

## Testing Decisions

A good test checks what a player can see or use through the real interface. It doesn't assert class names or token values, and it doesn't mirror the layout math.

**Proposed seams, highest first:**

1. **Real app in the browser and in Electron.** The main seam. One Playwright test opens the same dev-router routes in full-screen Electron and in Chromium at the same size, then compares control positions. It fails when the layouts drift. Prior art: the Playwright suite in `e2e/`, and the prototype's comparison, which matched within 1px at 1707×960.
2. **Native hit test in Electron.** Checks the window buttons, drag areas and clickable controls. Prior art: the throwaway Electron probes described in the project's probe notes.
3. **Per-frame motion sampling.** Checks the chevron and slide timing, the fixed content height and reduced motion, in Playwright.
4. **Existing component tests.** The game menu, left panel, full screen shell and Settings tests change with the new behavior.
5. **Header fold unit tests.** The fold's pure width logic stays covered by its existing tests. The new spacer subtraction needs a guard that fails if it's removed.

Each new guard should be proven by reinstating the bug it catches.

## Out of Scope

- The popup title bar sweep, which runs as its own effort.
- A new world or save shape. Nothing here changes export shape.
- A version bump.
- An edge-to-edge window on macOS and Linux (Q20). A later effort can add it with a machine to test on.
- Esc opening a game menu. It needs its own decision.
- An entity name caption on the entity image. It was suggested and not asked for.
- An interface-wide scale setting. Windows display scaling already works at 100% to 300%.

## Further Notes

**Prototype.** Question: can the desktop app drop the Windows bar, with a consistent header across Surfaces? Verdict: yes.

- Branch `prototype/edge-title-bar`, commit `38a7bd516`, in worktree `.claude/worktrees/prototype-edge-title-bar`.
- It's throwaway, so tickets should build from main and use it as a reference.
- Launch from the worktree with its `proto-edge-title-bar` dev server on port 5247, then run this in PowerShell:

```powershell
$env:VITE_DEV_SERVER_URL = 'http://localhost:5247'; npx electron .
```

**Not yet confirmed:**

- The Snap Layouts menu. Windows reports a real maximize button, but nobody has hovered it in a recorded check.
- How the Windows hover rectangle looks over the window buttons.
- Loading a save through the new button. Testing stopped at the load confirmation.
- The Entity View slide with a real image or model, and its open direction at full height.
- Windows Text size, which is a separate setting from display scale.

**Also needed in the tickets:**

- A Writing Guide pass on the new Backup row, tooltips and any new labels.
- Design System entries for the two-segment button, the corner gradient and window button dimming, which are new visual patterns. The owner approved them in this prototype.
- Updates to the player docs and help topics that name the old menu locations, starting with Saves and Backup, Settings and Library.
- A check of Take Me There targets and tutorials that point at the old menu buttons.
- A dev-route entry for anything new that a route can't reach.
- A changelog entry for each landed ticket.
