# 01: Window And Header Line

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rulings: Q1, Q2, Q3, Q13, Q16, Q19, Q20. Workload: Electron main process, native hit testing and many Surfaces at once.

## What to build

The desktop window loses the Windows title bar, and content reaches the top edge. Windows still draws its own minimize, maximize and close buttons, in the theme's foreground color. A player can drag the window by the empty parts of the header, and every control there stays clickable.

Every Surface's top row centers on one 56px header line, and nothing sits under the window buttons. That covers the main menu, the game Surface, the World Editor, Community Creations and the full screen editor shell. Top-right toasts start below the header.

Web takes the same header line, lifted main menu bar, game header row and toast position. Desktop differs only by the room held for the window buttons.

All window changes apply only on Windows. The macOS and Linux desktop builds keep the native title bar and today's minimum size, leave the desktop flag off, and use the web layout.

The game Surface reserves a full header row above all three columns here. Ticket 03 raises the left and center panels. The existing menus stay until tickets 02 and 03 replace them.

This ticket owns the window chrome module, the desktop flag, the symbol color channel and the shared header tokens. Later tickets build on them and don't add their own.

The prototype on `prototype/edge-title-bar` shows one working version. Build from main, and read the spec's "What the prototype learned" first.

## Acceptance criteria

- [x] In Electron, the Windows title bar is gone and content starts at y=0. e2e `runs without a title bar, from y=0`.
- [x] A native hit test reports minimize, maximize and close at the window buttons, caption on empty header space, and client on every visible header control. e2e, `WM_NCHITTEST` per Surface, plus `reports the three window buttons`.
- [x] Dragging stays available while a dialog is open. e2e `drags while a dialog is open`; the World Editor test covers a full-window dialog.
- [x] The window buttons take the theme's foreground color, and change when the theme changes. e2e spies on `setTitleBarOverlay` across a theme flip.
- [x] The minimum content size is 800×600. e2e `holds the content area to 800x600`.
- [x] At 1280 wide, on the main menu, game Surface, World Editor, Community Creations and full screen editor, top-row controls center within 1px of y=28, except that the World Editor bar may sit at y=29. e2e per Surface, in Electron and in Chromium.
- [x] At 1280 and 900 wide, no visible control on those Surfaces sits under the window buttons. e2e per Surface in Electron.
- [x] A top-right toast starts below the 56px header on desktop and on web at `md` and wider. e2e in Electron and in Chromium.
- [x] Mobile layout is unchanged, confirmed by frames at 375 wide. frames `window-*-375.png`, plus e2e bar and corner positions.
- [x] Nothing in the web build reads the overlay's `env()` values unless the desktop flag is set, because a host can define them. e2e reads `--window-buttons-width` as `0px`; reinstating `env()` there fails it.
- [x] A test of the window options confirms that macOS and Linux get the native title bar, no overlay, no new minimum size and no desktop flag, and it fails if the platform check is removed. `electron/windowChrome.test.mjs`; removing the platform check fails it.
- [x] Frames in `.scratch/frames/`: `window-menu.png`, `window-game.png`, `window-editor.png`, `window-community.png`, each in both themes at 1280 wide. stored as `-dark` and `-light` at 1280 wide, plus `window-shell-*`.
- [x] A guard for the desktop flag and the hit test fails when the bug it catches is reinstated. 15 reinstated bugs each failed their guard.
- [x] The docs that describe the window or its controls match. `docs/Design-System.md` gains Header Line; no player doc describes the title bar.

For you: hover the maximize button in the desktop app and confirm the Snap Layouts menu appears.
For you: hover each window button and judge the Windows hover rectangle.
For you: drag the window around in each Surface and judge whether the grab areas feel big enough.

## Landed

**Not verified**

- None. Every criterion above is ticked.

**For you**

- For you: hover the maximize button in the desktop app and confirm the Snap Layouts menu appears.
- For you: hover each window button and judge the Windows hover rectangle.
- For you: drag the window around in each Surface and judge whether the grab areas feel big enough.
- Frames: `.scratch/edge-to-edge-window-01/frames/window-menu-dark.png` and its siblings. Page captures don't show the native buttons.

**For ticket 07**

- Avatar Customization: the right-side card sits at `m-4`, so its scrolling controls pass under the window buttons.
- Formaquestion's full sheet reaches the corner. Its drag handles and frame already take clicks in the header line.
- Formaquestion's chat bubbles aren't controls, so bubble text in the header line drags the window.
- Ordinary tall dialogs: at 800×600, a full-height dialog's close button can sit under the window buttons.
- The other routes still need the audit.

**Also seen**

- The first-run intro's canvases are no-drag, so the window can't be dragged from them during the intro.
- These e2e specs fail on the base commit too: `entity-panel-widths`, `community-browser` (the tour test) and `fullscreen-morph` (the Mascot split test).
