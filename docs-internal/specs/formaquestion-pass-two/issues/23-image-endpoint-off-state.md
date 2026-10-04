# 23: Image endpoint off state and badge slot

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Image endpoint tab in Settings behaves like the Mascot tab when its feature is off, and its reachability badge stops moving the rows around it.

- Enable Image Generation stays on the tab. With it off, everything below stays mounted and disabled, under one line in the help voice that says image generation is off, instead of unmounting (Q73). The Tag Prompt sub-tab stays hidden as today.
- The reachability badge under the preset header gets a fixed slot: constant height and reserved width in every state, probing, reachable, unreachable and no badge, so a toggle or a probe rerun never shifts the rows (Q74).

Spec: Q73, Q74; Further Notes.

Recommended model rationale: a mount-to-disable swap and a reserved slot on one Settings tab, guarded by its badge and header tests.

## Acceptance criteria

- [ ] Component tests: with image generation off the connection rows render disabled under the line, and the switch still toggles; the badge's slot keeps one height across its states.
- [ ] Playwright: toggling the switch at 1600×900 moves no row above the content; the badge's box does not change size between probing and reachable.
- [ ] The four gates are green.
