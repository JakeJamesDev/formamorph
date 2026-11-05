# 05: Window Button Legibility

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rulings: Q4, Q5, Q20. Workload: a small visual change plus a timing-sensitive check of dialog state.

## What to build

The window buttons stay readable over any world art. In game, a soft gradient in the theme's background color sits in the top-right corner, above the location art and behind the panels and buttons, with no hard edge. Other Surfaces need none, because each has a solid background there.

While a dimming layer reaches the window buttons, their symbols fade to white at 25% in step with the page. When the popup closes, they return to the theme color. A full-window dialog that covers the dimming layer keeps them at full color. The check has to rerun after animations end, because a dialog covers its dimming layer only after it opens, and it must not run on every page change during streaming.

This builds on ticket 01's symbol color channel. Add the gradient and dimming to the Design System, since the owner approved them in the prototype.

## Acceptance criteria

- [ ] In the desktop app, window button symbols are readable over City Rampage, Sugarscape and Veilwood art in both themes.
- [ ] The gradient sits behind Save, Load, Settings, `...` and the right column, and has no hard edge.
- [ ] The gradient and symbol dimming appear only in the Windows desktop app (Q20), and the gradient is gone in full screen once ticket 06 lands.
- [ ] With Settings open, the symbols show the dimmed color, and return to the theme color after closing.
- [ ] Over the World Editor and the full screen editor, the symbols keep full color.
- [ ] An alert dialog and a nested dialog both dim the symbols.
- [ ] Sustained streaming narration causes no repeated corner checks, confirmed by counting them during a test turn.
- [ ] Frames in `.scratch/frames/`: `legibility-art.png` and `legibility-dimmed.png`, each in both themes, captured from the real window so the native symbols show.
- [ ] Both patterns appear in the Design System.

For you: judge the gradient over your own bright and dark worlds.
For you: open and close Settings and judge how the symbols' fade matches the page.
