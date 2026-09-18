# 04: Shared Color Picker

Status: ready-for-human
Status note: Built in 445443d3 + 5989976e. The picker inside a real Dialog and on touch is not verified live; ticket 05 mounts it in Settings.
Base: 38306acb
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/quote-color/spec.md`

## What to build

The app's standard color picker: a swatch button that opens a popover with a saturation square, a hue
bar, a hex text field, and an optional reset action. It has no game or settings dependency and appears in
the design-system showcase.

## Acceptance criteria

- [ ] `react-colorful` is added after confirming the latest version and package identity from the registry.
- [ ] Props: value (6-digit hex), change handler, optional reset handler and reset label. No alpha, no swatches.
- [ ] The hex field commits only valid 6-digit values; an invalid entry keeps the last valid color.
- [ ] The popover works inside a dialog: wheel scroll and touch follow the popover-in-dialog convention.
- [ ] The trigger, the square, the hue bar, the hex field, and reset are reachable by keyboard; the trigger follows the asChild forwardRef rule.
- [ ] Both themes verified; focus ring is inset.
- [ ] A component test covers hex commit, invalid hex, reset, and the swatch reflecting the value.
- [ ] Showcase entry added. Changelog In-Progress entry under the dev-tooling bucket. Four gates green.
