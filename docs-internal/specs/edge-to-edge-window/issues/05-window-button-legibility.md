# 05: Window Button Legibility

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rulings: Q4, Q5, Q20. Workload: a small visual change plus a timing-sensitive check of dialog state.

## What to build

The window buttons stay readable over any world art. In game, a soft gradient in the theme's background color sits in the top-right corner, above the location art and behind the panels and buttons, with no hard edge. Other Surfaces need none, because each has a solid background there.

While a dimming layer reaches the window buttons, their symbols fade to white at 25% in step with the page. When the popup closes, they return to the theme color. A full-window dialog that covers the dimming layer keeps them at full color. The check has to rerun after animations end, because a dialog covers its dimming layer only after it opens, and it must not run on every page change during streaming.

This builds on ticket 01's symbol color channel. Add the gradient and dimming to the Design System, since the owner approved them in the prototype.

## Acceptance criteria

- [x] In the desktop app, window button symbols are readable over City Rampage, Sugarscape and Veilwood art in both themes. Real-window frames `legibility-<world>-<theme>.png` and the corner sheet `legibility-corners.png`.
- [x] The gradient sits behind Save, Load, Settings, `...` and the right column, and has no hard edge. E2E "game: the corner gradient sits in the top-right corner…" plus the frames.
- [ ] The gradient and symbol dimming appear only in the Windows desktop app (Q20), and the gradient is gone in full screen once ticket 06 lands. Windows only: verified by the web e2e (gradient hidden) and the unit tests (no bridge, no checks). The full-screen half waits on 06.
- [x] With Settings open, the symbols show the dimmed color, and return to the theme color after closing. E2E "dims the window buttons under Settings in game…", both themes, read from `setTitleBarOverlay` in the main process.
- [x] Over the World Editor and the full screen editor, the symbols keep full color. E2E "keeps the window buttons at full color over the …".
- [x] An alert dialog and a nested dialog both dim the symbols. E2E "dims the window buttons under an alert dialog and a nested dialog"; unit test "stays dim while a nested dialog closes over its parent".
- [x] Sustained streaming narration causes no repeated corner checks, confirmed by counting them during a test turn. E2E "runs no repeated corner checks while narration streams": a local endpoint streams 300 chunks over 3 seconds, and the turn makes at most 4 hit tests (767 with the probe bug reinstated). It runs the real window chrome in Chromium over a stub bridge, because the Electron build routes turns to its local engine.
- [x] Frames in `.scratch/frames/`: `legibility-art.png` and `legibility-dimmed.png`, each in both themes, captured from the real window so the native symbols show. `PrintWindow` captures, `-dark`/`-light` suffixes.
- [x] Both patterns appear in the Design System. "Pattern: Window Corner" in `docs/Design-System.md` and the live Window Corner reference.

For you: judge the gradient over your own bright and dark worlds.
For you: open and close Settings and judge how the symbols' fade matches the page.

## Landed

**Not verified**

- The gradient in full screen: ticket 06 owns it. The gradient shows under `[data-window-overlay]`, so 06 must clear that flag in full screen or add a rule for `[data-window-corner-gradient]`.

**For you**

- For you: judge the gradient over your own bright and dark worlds. Frames: `.scratch/edge-to-edge-window-05/frames/legibility-corners.png` and `legibility-<world>-<theme>.png`.
- For you: open and close Settings and judge how the symbols' fade matches the page. Frames: `.scratch/edge-to-edge-window-05/frames/legibility-dimmed-dark.png`, `legibility-dimmed-light.png`.
- Open the World Editor from the main menu and watch the window buttons. They dim for about 150ms while the editor zooms in, then return to full color, as in the prototype. Say if that flash should go.
- The gradient stays on with Hide UI, over the raw art. Say if it should hide with the panels.
