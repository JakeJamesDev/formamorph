# 10: Answer Reveal

Status: done
Base: bfcb41fa
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The help answer's text reveal has its own setting, with the same button and dialog as Narration Reveal (Q7, Q17, Q29).

- The General tab gains an **Answer Reveal** row with the reveal button. It opens the reveal dialog on help's own values, through the dialog's settings source.
- Help's values start at narration's defaults. They never read narration's stored values, and a change to one never changes the other.
- The help answer draws with help's values: the effects, the easing and the speed.
- The reveal timing is one shared value today, written by the game view. Help gets its own timing value, so a help answer and a game turn do not write over each other.
- Reduced motion is respected as in narration.
- The dialog's Reset returns help's values to the defaults.

The General docs section gains the row.

Recommended model rationale: about a dozen stored values and a split of a shared timing value that the game view depends on.

## Acceptance criteria

- [ ] A change in the dialog changes how the next help answer reveals, and does not change narration.
- [ ] A change to Narration Reveal does not change help.
- [ ] With all effects off, a help answer shows with no animation.
- [ ] The game view's reveal timing is not written by a help answer (a test with both active).
- [ ] The values survive a reload; a bad stored value falls back to the default.
- [ ] The existing reveal dialog tests pass with no edit to an assertion.
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
