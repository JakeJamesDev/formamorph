# 07: Mask handles

Status: ready-for-human
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Mask is an editable box the player resizes and moves with handles.

- Eight handles (four corners, four sides) and a center move grip, in base pixels. A corner drag moves two edges, a side drag one, the center drag the box. The box stays inside the base and above a minimum size. A press outside the box still draws a new one.
- Handles and grip sit at low opacity until the pointer hovers the box or a drag runs; on a coarse pointer they stay at full opacity. Reduced motion drops the fade.
- A focused handle moves one base pixel per arrow key, ten with Shift.

Spec: Q16; Implementation → Mascot tab.

Recommended model rationale: pointer geometry across nine drag targets with touch and keyboard paths.

## Acceptance criteria

- [ ] Component tests through the pointer hook: each handle changes the right edges, the center moves the box, the box clamps to the base and the minimum, arrow keys move a focused handle.
- [ ] Playwright: the fade on hover and its absence on a coarse pointer.
- [ ] The four gates are green.
