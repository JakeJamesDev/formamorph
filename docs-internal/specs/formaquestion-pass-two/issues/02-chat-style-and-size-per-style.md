# 02: Chat Style and size per style

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The player chooses Auto, Minimal or Full chat style, and each style keeps its own size.

- A Chat Style row on the General tab and the same three choices in the pill's ⋮ menu, writing one help settings field (default Auto).
- The chrome rule is one pure function: Auto is minimal while the Mascot is on; Minimal and Full pin. Full with the Mascot on floats the mascot piece beside the full frame. A change while the window is open swaps the chrome in place.
- The stored window box holds a size per style and one position; an old box reads as nothing, since the key never shipped (Q30). The minimal column gets the same corner resize grip as the full frame.

Spec: Q9, Q10, Q11; Implementation → Window layout module, Help settings, Window.

Recommended model rationale: a settings field, a layout shape change, and the window's chrome in one slice.

## Acceptance criteria

- [ ] Each style and Mascot pairing renders the right chrome; the ⋮ menu and the General row agree.
- [ ] Resizing in minimal and swapping to Full keeps both sizes after a reload; the position is shared.
- [ ] The codec and window box tests cover the default and the round trip.
- [ ] Playwright: the minimal grip and the per-style size after a reload.
- [ ] The four gates are green.
