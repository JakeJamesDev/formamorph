# 24: Image endpoint header off

Status: done
Blocked by: 23
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

## What to build

With image generation off, the Image endpoint tab's preset header disables like the Mascot tab's.

- The preset header (select and actions) and the reachability badge disable while Enable Image Generation is off; the checkbox stays usable. The window below keeps ticket 23's off state.
- The badge keeps its fixed slot while disabled (Q74).

Spec: Q76; Further Notes.

Recommended model rationale: one disabled flag on an existing header.

## Acceptance criteria

- [ ] Component test: with image generation off the header's select and actions are disabled and the checkbox toggles; on, they work again.
- [ ] The four gates are green.
