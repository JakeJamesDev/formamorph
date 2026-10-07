# 03: Find Bar Fields

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: the Find bar is dense, has two layouts, pinned focus semantics, and existing trailing cells; placing the X without breaking the match toggles, the counter, or the collapse flow needs care.

## What to build

Every Find bar text box gets an inner clear X as the innermost trailing cell (Q7). The Find box, floating and docked expanded, and the collapsed docked **Search World** field get **Clear Search** (Q14). In the collapsed field the X sits before the options badge and the counter; in the expanded bar, before the match toggles. The Replace box gets **Clear Replace** in both layouts, in text mode only; the placeholder picker gets none (Q15). Clearing empties the box and returns focus to it; it does not collapse the bar or change the expanded state. The debounced query and marker follow the empty value as they do for typing.

The row-end button is a close, not a clear. It renames to **Close Search** when docked and **Close Find** when floating (Q6 revised), with its tests, the Design System Find bar lines, and the World Editor docs.

Changelog: none; 01's lead covers it (Q13).

## Acceptance criteria

- [ ] Floating Find, docked expanded Find, and the collapsed docked field show **Clear Search** while they hold text; the toggles, badge, counter, and navigation keep their edge positions.
- [ ] Replace shows **Clear Replace** in text mode in both layouts and nothing in placeholder mode.
- [ ] Clearing empties the box, keeps the bar in its current layout and expanded state, and focuses the box.
- [ ] The row-end button is named **Close Search** docked and **Close Find** floating; the find-expand, Find bar reference, and World Editor docs use the new names.
- [ ] One test per box that the X clears it; no existing assertion is weakened.
- [ ] Four gates green.
