# 06: Full Screen Matches The Browser

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rulings: Q14, Q16, Q17, Q20. Workload: Electron state plus the effort's main drift guard, which runs both builds side by side.

## What to build

The window buttons go away in full screen, so the room saved for them goes too. The overlay keeps reporting its size in full screen, so the main process tells the page about the change, and the page clears the desktop flag. Full screen then uses the browser layout. Leaving full screen brings the room back, including after a reload while in full screen.

While in full screen, an Exit Full Screen item shows in the `...` menu, and F11 keeps working. The game's `...` always exists. The main menu has no `...` at full width, so it shows one in full screen to hold this item. Other full-window Surfaces rely on F11 or on going back first.

One Playwright test opens the same dev-router routes in full-screen Electron and in Chromium at the same size, then compares control positions. It fails when the layouts drift. Known desktop-only and web-only controls are named in one list in the test, with a reason for each.

## Acceptance criteria

- [ ] Entering full screen removes the empty space, and the header's right-side buttons reach the window edge, on the main menu and game Surface.
- [ ] Leaving full screen restores the room for the window buttons.
- [ ] Reloading while in full screen keeps the full-screen layout.
- [ ] Exit Full Screen shows in `...` only while in full screen on Windows, and leaves it, on the main menu and game Surface. It never shows on macOS, Linux or web.
- [ ] The drift test covers the main menu and game Surface at 1707×960 and one narrower size, within 1px per control.
- [ ] Reinstating desktop-only room in full screen makes the drift test fail.
- [ ] The drift test runs through the project's Playwright suite, and the Electron launch uses a short temporary profile path.
- [ ] Exit Full Screen's copy follows the Writing Guide.
- [ ] Frames in `.scratch/frames/`: `full-menu.png` and `full-game.png`, each in both themes.
- [ ] Player docs name Exit Full Screen and F11 as Windows desktop controls.

For you: enter and leave full screen with F11 and with Exit Full Screen, and judge whether anything jumps.
