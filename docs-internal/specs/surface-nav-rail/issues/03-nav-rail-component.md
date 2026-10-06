# 03: Nav Rail Component

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: a new shared component with tab-list keyboard semantics, persistence, motion and reduced-motion handling; correctness and accessibility both matter.

## What to build

The **Nav Rail** as a shared component with its own tests and a Design System showcase entry (Q3, Q4, Q8, Q17, Q19–Q21). No host adopts it in this ticket.

- A vertical tab list inside its host's tab root: each item is a tab trigger named by its label; arrow keys move along it. The host's panels stay where they are.
- Groups in order. A plain line between drawn groups, nothing for an empty group, no captions.
- The active tab carries a primary accent bar on the rail's edge.
- Collapse toggle at the foot. Expanded or collapsed persists per storage key in browser storage, and a failed read or write falls back to the default without error. Both defaults are expanded (Q3).
- An auto-collapse input from the host draws the rail collapsed without writing the stored state (Q17).
- A disabled flag draws every tab disabled and leaves the selection.
- Collapsed: a flyout names the tab on hover or keyboard focus, never on a pointer focus.
- Motion, from the prototype: one row layout in both states, with the icon 11px in so it centers in the 52px collapsed rail. Width animates 52px ↔ 192px over 200 ms on `cubic-bezier(0.2, 0, 0, 1)`. Labels stay mounted, clip in their own box and fade on the same duration and curve. Reduced motion skips the animation.

The Design System guide gains "Pattern: Nav Rail", proposed with its showcase entry, before any surface adopts it. Changelog fragment: none, since nothing player-facing changes until ticket 04 or 07.

From the prototype branch `prototype/world-editor-tabs` (final commit `dbe3c035`, Community header `54a3e233`); launch entry `proto-world-editor-tabs`, port 5245. Motion settled in commits `9c5f5e13` and `05c0b4d3`.

## Acceptance criteria

- [ ] Renders one tab per item, named by its label; the active tab is selected and carries the accent marker.
- [ ] Draws a line between groups and none for an empty group; no captions anywhere.
- [ ] Arrow keys move between tabs.
- [ ] The toggle collapses and expands; the choice survives a remount for the same storage key and not across keys.
- [ ] Auto-collapse draws collapsed without changing the stored choice.
- [ ] Disabled renders every tab disabled.
- [ ] A collapsed tab shows its name on hover and on keyboard focus.
- [ ] With reduced motion the width changes without animation.
- [ ] Guard bites: letting auto-collapse write the stored state turns the persistence test red.
- [ ] Design System pattern and showcase entry added.
- [ ] Gates green.

## Blocked by

- None (can start immediately)
