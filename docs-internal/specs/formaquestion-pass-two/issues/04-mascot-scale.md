# 04: Mascot scale

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A Scale slider sizes the mascot on this device.

- A device value beside the window box: Auto or a percent of the base's pixel size, 25% to 150%, default Auto. It is never in the card.
- Auto fits the masked mascot to the chat's height (the column, or the full frame under Full) and follows resizes. A percent sizes it to that share of the base's natural pixel height at its aspect, clamped to the screen. The head view scales with it.
- The slider sits beside the rig preview on the Mascot tab. The tab preview does not scale; the window does.

Spec: Q3, Q17, Q21; Implementation → Window layout module, Mascot tab.

Recommended model rationale: a layout rule with two modes and a device value with its own storage.

## Acceptance criteria

- [ ] Layout tests: Auto equals the chat height; a percent equals that share of the base's pixel height; both clamp.
- [ ] The slider writes the device value and the window's mascot follows after a reload; an imported card keeps the scale.
- [ ] The four gates are green.
