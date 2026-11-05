# 06: Full Screen Matches The Browser

Status: done
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rulings: Q14, Q16, Q17, Q20. Workload: Electron state plus the effort's main drift guard, which runs both builds side by side.

## What to build

The window buttons go away in full screen, so the room saved for them goes too. The overlay keeps reporting its size in full screen, so the main process tells the page about the change, and the page clears the desktop flag. Full screen then uses the browser layout. Leaving full screen brings the room back, including after a reload while in full screen.

While in full screen, an Exit Full Screen item shows in the `...` menu, and F11 keeps working. The game's `...` always exists. The main menu has no `...` at full width, so it shows one in full screen to hold this item. Other full-window Surfaces rely on F11 or on going back first.

One Playwright test opens the same dev-router routes in full-screen Electron and in Chromium at the same size, then compares control positions. It fails when the layouts drift. Known desktop-only and web-only controls are named in one list in the test, with a reason for each.

## Acceptance criteria

- [x] Entering full screen removes the empty space, and the header's right-side buttons reach the window edge, on the main menu and game Surface. `window-chrome.spec.ts` "full screen gives the window buttons' room to the header": room reads 0, rightmost control within the bar's margin of the edge.
- [x] Leaving full screen restores the room for the window buttons. Same test, after leaving: room back, rightmost control clear of it.
- [x] Reloading while in full screen keeps the full-screen layout. "keeps the full-screen layout through a reload": the flag never appears from the first script on; proven by a delayed-read mutation going red.
- [x] The corner gradient from ticket 05 is gone in full screen. The flag clears in full screen; the game test asserts the gradient hidden, then visible after leaving.
- [x] Exit Full Screen shows in `...` only while in full screen on Windows, and leaves it, on the main menu and game Surface. It never shows on macOS, Linux or web. Electron tests per Surface; web test "never offers Exit Full Screen"; Electron unit tests gate every main-process call on `win32`.
- [x] The drift test covers the main menu and game Surface at 1707×960 and one narrower size, within 1px per control. "full screen lays out as the browser does" at 1707×960 and 1200×800, by control center.
- [x] Reinstating desktop-only room in full screen makes the drift test fail. Keeping the flag in full screen turned both sizes red on positions.
- [x] The drift test runs through the project's Playwright suite, and the Electron launch uses a short temporary profile path. It sits in `e2e/window-chrome.spec.ts`, whose launch uses `mkdtemp(tmpdir(), 'fm-wc-')`.
- [x] Exit Full Screen's copy follows the Writing Guide. A label in Title Case, as the guide's label row asks.
- [x] Frames in `.scratch/frames/`: `full-menu.png` and `full-game.png`, each in both themes. Stored as `full-menu-dark.png`, `full-menu-light.png`, `full-game-dark.png`, `full-game-light.png`.
- [x] Player docs name Exit Full Screen and F11 as Windows desktop controls. `docs/How-to-Play.md` Game Actions and `docs/Library.md`.

## Landed

**Not verified**

- Pressing the F11 key itself. Playwright's key presses reach the page, not the native menu, so the test runs the `togglefullscreen` menu item F11 triggers and reads its accelerator.
- The HTML Fullscreen API. Nothing in the app calls it today. If a video or embed goes full screen, Exit Full Screen would show behind it.

**For you**

- Enter and leave full screen with F11 and with Exit Full Screen, and judge whether anything jumps. Frames: `.scratch/edge-to-edge-window-06/frames/full-menu-dark.png`, `full-menu-light.png`, `full-game-dark.png`, `full-game-light.png`.
- Per Q25, the desktop folds each main menu step 48px wider than the web in full screen. One step earlier between 1245–1292, 1077–1124 and 993–1040 wide.

**Notes**

- The drift test compares control centers. Electron's and Playwright's Chromium builds round some text widths under a pixel apart, evenly on both sides.
- With `WINDOW_FRAMES_DIR` set, ticket 05's "frames the window buttons over bundled world art" leaves Veilwood's Readme open, so the next game test can't find Save Game. It only runs on request.
