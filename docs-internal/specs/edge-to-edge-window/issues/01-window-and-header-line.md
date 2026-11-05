# 01: Window And Header Line

Status: ready-for-agent
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

- [ ] In Electron, the Windows title bar is gone and content starts at y=0.
- [ ] A native hit test reports minimize, maximize and close at the window buttons, caption on empty header space, and client on every visible header control.
- [ ] Dragging stays available while a dialog is open.
- [ ] The window buttons take the theme's foreground color, and change when the theme changes.
- [ ] The minimum content size is 800×600.
- [ ] At 1280 wide, on the main menu, game Surface, World Editor, Community Creations and full screen editor, top-row controls center within 1px of y=28, except that the World Editor bar may sit at y=29.
- [ ] At 1280 and 900 wide, no visible control on those Surfaces sits under the window buttons.
- [ ] A top-right toast starts below the 56px header on desktop and on web at `md` and wider.
- [ ] Mobile layout is unchanged, confirmed by frames at 375 wide.
- [ ] Nothing in the web build reads the overlay's `env()` values unless the desktop flag is set, because a host can define them.
- [ ] A test of the window options confirms that macOS and Linux get the native title bar, no overlay, no new minimum size and no desktop flag, and it fails if the platform check is removed.
- [ ] Frames in `.scratch/frames/`: `window-menu.png`, `window-game.png`, `window-editor.png`, `window-community.png`, each in both themes at 1280 wide.
- [ ] A guard for the desktop flag and the hit test fails when the bug it catches is reinstated.
- [ ] The docs that describe the window or its controls match.

For you: hover the maximize button in the desktop app and confirm the Snap Layouts menu appears.
For you: hover each window button and judge the Windows hover rectangle.
For you: drag the window around in each Surface and judge whether the grab areas feel big enough.
