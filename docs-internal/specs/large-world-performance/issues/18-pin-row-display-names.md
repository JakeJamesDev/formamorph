# 18: Pin Row Display Names

Status: ready-for-agent
Blocked by: 17
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: memoization in the shared pin-row list; contained, with an existing render seam.

## What to build

A trait or location that pins hundreds of placeholders opens its **Pins** tab quickly (Q25). On the pin world, opening "Pin Heavy Trait"'s Pins tab (200 pins) spent about 1.5 s at 1x building placeholder display names, one lookup over all placeholders per row. The pin rows read display names from one map built per render of the list, keyed by placeholder id, rebuilt only when placeholders change. Typing on a heavily pinning source stays responsive once ticket 17 has removed the rules-pass cost. No visible change. Report `npm run profile:editor-speed` pin steps before and after at 6x (Q7).

## Acceptance criteria

- [ ] Harness `pinSourceTrait` and `pinSourceLocation` at 6x: the Pins tab opens with no block over 1 s, and typing into Name meets Q1.
- [ ] Pin rows show the same names, letters and labels as before (existing pin-row tests pass unchanged).
- [ ] Editing one pin's value re-renders that row only (render-count test).
- [ ] Guard bites: building names per row again brings the Pins-tab cost back (numbers recorded).
- [ ] Four gates green.
