# 02: Mascot Position row and menu entry

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The player picks Beside, Below or Auto from the General tab or the pill's ⋮ menu, and the two always agree.

- The General tab's Window section gains a **Mascot Position** row after Chat Style: an OptionSwitcher Beside / Below / Auto. Hint in plain text under 12 words. The ⓘ defines each value in one short line.
- The ⋮ menu lists the same three values under a label beside Chat Style, the current one marked. Both write the one per-device store from ticket 01.
- Picking Below while the column is taller than the cap clamps the column to the cap at once and stores that height.
- The Mascot switch's hint loses "beside".
- The sheet shows no Position row.

Spec: Q1, Q5, Q9; Implementation → General tab and menu, Copy.

Recommended model rationale: a settings row and a menu entry with direct prior art in the Chat Style row and menu.

## Acceptance criteria

- [ ] Render tests: the row sits after Chat Style with the three values; choosing one writes the store; the menu shows the same values with the current one marked; the sheet shows no row.
- [ ] Picking Below with a column above the cap stores the cap height.
- [ ] Copy passes the copy sweep: AP title case labels, verb-first hint, ⓘ lines per the writing guide.
- [ ] The four gates are green.
