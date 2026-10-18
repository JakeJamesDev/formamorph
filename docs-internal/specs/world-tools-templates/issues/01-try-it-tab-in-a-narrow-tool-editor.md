# 01: Try It Tab In A Narrow Tool Editor

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: one component, a width observer and tab state, with a layout check at real sizes.

## What to build

When the Tool editor is narrow, Try It leaves its side column and becomes a fourth tab after Definition, Parameters and Handler (Q2). The trigger is the editor's own measured width, not the viewport (Q1). One Try It instance serves both layouts and stays mounted while hidden, so its inputs and last result survive a tab switch (Q13). When the editor widens with Try It open, the editor returns to the last form tab (Q8). The change covers the Settings Tool editor and the World Editor Tools tab.

Spec: Q1, Q2, Q8, Q13; stories 1–9.

## Acceptance criteria

- [ ] Narrow: the strip shows a Try It tab and the side column is gone; wide: the reverse
- [ ] Try It inputs and its last result survive a switch to Handler and back
- [ ] Widening with Try It open lands on the last form tab
- [ ] The Try It tab shows its icon when the strip hides labels
- [ ] Render tests drive a stubbed editor width; each guard bites when its bug returns
- [ ] `verify-ui` at real sizes in both the Settings and World Editor homes picks and confirms the threshold
- [ ] Changelog fragment written; four gates green
