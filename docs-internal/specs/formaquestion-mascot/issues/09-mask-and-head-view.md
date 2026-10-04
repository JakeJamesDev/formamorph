# 09: Mask and head view

Status: ready-for-human
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A head-only view for narrow screens and for the desktop toggle.

- On the tab, the player drags a box on the rig preview to set the Mask, stored in base pixels. A head preview updates live.
- On mobile the masked head sits left of the pill row; there is no full view.
- On desktop the pill gets a head/full toggle, remembered per device with the window box.

Spec: Q6, Q20, Q24; Implementation → Window, Mascot tab.

Recommended model rationale: a drag widget and two layouts of the same crop.

## Acceptance criteria

- [ ] Dragging on the preview stores a Mask and the head preview follows.
- [ ] The mobile sheet shows the head left of the pill; the desktop toggle swaps full and head and survives a remount.
- [ ] Playwright: the Mask drag and the mobile head.
- [ ] The four gates are green.
