# 03: Code Rider on the Help Preset

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [spec.md](../spec.md), rulings Q3, Q5, Q6, Q13, Q15.

## What to build

The help preset gains a fourth text, the **Code** rider, with a default and a reset, shown in the preset editor beside the answer and lookup texts. On a code turn the rider is appended to the request's user message; on every other turn the request is byte-identical to today. A code turn is one where the open surface includes a stat's Code tab, or the question matches the code-word list that lives beside the rider in code.

The rider's contract, in positive form: give the full contents of each box as one fenced `javascript` block, tag the fence with its slot (`before` or `after`) after the language, name the box in one sentence before the block, keep the numbered steps short. No example code the model could parrot. The 800-token cap stays.

A world author can open the preset editor, read the rider, change it, and see it in the prompt diff viewer on a code question.

Workload: prompt writing for small models plus the preset codec and editor field. A top model at high effort; read the prompt-writing guide first. Probe numbers come from ticket 04, not this one.

## Acceptance criteria

- [ ] The preset holds a `code` text; the Default preset's text follows the code of this build; custom presets keep theirs
- [ ] The preset editor shows the Code rider beside the other texts with a per-field reset
- [ ] A question with code words rides the rider; any question with a stat Code tab open rides it; an ordinary question does not, and its request is unchanged from today
- [ ] A custom preset's rider text is sent verbatim
- [ ] The cap is 800 on rider turns
- [ ] The rider carries no example code
- [ ] Help preset export shape reminder in the response if the preset file gains the field
- [ ] Changelog line under In Progress, Added, 👤
