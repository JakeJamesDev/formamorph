# 04: Faster authoring

Status: ready-for-human
Base: 8d9bffd5
Blocked by: 03 — Templates and Custom Persona
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: two new flyouts and a menu extension over existing add and link paths. UI wiring with a design-system approval gate.

Parent: [Trait Links spec](../spec.md)

## What to build

An author adds an owned trait or group straight onto an entity from the Traits tab's **+** menu, and links any linkable node to a bearer from a link button on its Details header. Both flyouts nest entities by entity group with Custom Persona first.

## Acceptance criteria

- [ ] The **+** menu gains **Add Trait To Entity →** (Basic) and **Add Group To Entity →** (Advanced). The first add to an entity creates its node, and the new row is selected in place.
- [ ] The drop projection refuses moving Templates or Custom Persona into a group; both stay at the root (Q68, left open by ticket 03).
- [ ] Every linkable node's Details header shows a link button in Advanced. Its flyout lists Custom Persona first when it exists, then entities nested by entity group.
- [ ] Bearers that already have the link show checked and disabled. Picking a bearer creates the link through the same path as a drag, including the one-original rule.
- [ ] Both flyouts are new visual patterns and get design-system approval before adoption.
- [ ] Component tests cover both menu entries, node creation on first add, the link flyout's ordering, and the checked-and-disabled state.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
