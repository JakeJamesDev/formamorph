# 08: Picks and Voice on the tab

Status: ready-for-human
Blocked by: 05, 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The player chooses the app's three looks and the character's voice.

- Three pick rows, Initial, Idle and Thinking, each an expression dropdown and a state dropdown. Each lists enabled layers of its kind only.
- A warning row names the picks that point at a disabled or missing layer; such a pick is kept and draws nothing for that layer.
- A Voice field that feeds the chip.

Spec: Q7, Q21, Q25; Implementation → Mascot tab.

Recommended model rationale: form rows over an existing codec and rule.

## Acceptance criteria

- [ ] Each dropdown lists enabled layers of its kind and nothing else.
- [ ] Disabling a picked layer keeps the pick, blanks that layer in the preview and shows the warning; re-enabling clears it.
- [ ] The Voice field's text reaches the request through the chip.
- [ ] The four gates are green.
