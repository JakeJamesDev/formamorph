# 07: Add the Locations Canvas Reference

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

**Model rationale:** The spatial editor has nested state, history, preferences, and context dependencies; isolation and faithful interaction require broader reasoning. This is a workload recommendation, not a model switch or ticket-specific benchmark. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A reviewer can explore a real Locations Canvas with nested Groups and Connections, inspect its spatial-workspace pattern, and perform local interactions without changing a saved world.

## Acceptance Criteria

- [ ] Add the production Locations Canvas to the existing development-only showcase using neutral sample locations with nested Groups, child locations, and representative directed Connections and labels.
- [ ] Document the spatial-workspace pattern: bounded work area, nested containment, connection hierarchy, floating tool groups, search, zoom/fit controls, minimap, and density. Preserve the domain distinction between Group containment and authored Connections.
- [ ] Isolate world state, history, and canvas preferences from real authored data and saved preferences. Confirm how context and storage dependencies behave before reuse; perform only necessary prefactoring before integrating the sample.
- [ ] Preserve manual layout and Auto Arrange semantics. Demonstrate search/reveal, selection, pan/zoom/fit, a local movement or arrangement, and undo/redo where applicable; do not introduce automatic persistent layout changes.
- [ ] Expose representative selected, disabled, focus, and overflow states with long names and connection labels. Keep the sample realistic enough to reveal hierarchy and overlap issues.
- [ ] Preserve current production drag, connection, and nesting behavior and applicable architecture decisions. Do not redesign the graph, change travel rules, or widen this ticket into a canvas refactor.
- [ ] Verify in a realistically sized editor context at desktop and mobile widths with static frames and structural evidence, both light/dark appearances, and representative font/palette inheritance. Respect reduced motion and existing touch behavior.
- [ ] Record responsive adaptations and any unresolved production limitation explicitly. User approval covers the existing reference; any newly needed visual pattern must be proposed before adoption.
- [ ] Review new functional toolbar names, descriptions, and status messages through the Writing Guide; sample authored location names retain their own voice.
- [ ] Keep guide, showcase registry, and skill discovery aligned. Retain existing canvas behavior and dev-route coverage; add meaningful isolation/integration guards where needed.
- [ ] Pass all four gates, time tests, update the knowledge graph after code changes, and add an In-Progress changelog entry.

## Verification

Use existing canvas behavior seams for state-changing actions and live preview for layout, hierarchy, controls, and accessibility. Prove demonstration actions remain local and history restores local changes. Do not rely on hidden-tab animation timing or strip the fixture to conceal overflow.

## Coordination and Scope

The existing design-system foundation is the prerequisite already supplied. Tickets 06, 07, and 08 have no new blocking edges between them; coordinate shared guide and showcase registry edits before concurrent work.

The user approved this existing UI as an additional starting reference and approved the three-ticket extension. Preserve the reference's composition without treating every existing flaw as a new standard. Name adjacent defects rather than silently redesigning the surface. No app-wide redesign, new palette, bulk copy rewrite, version bump, or export-shape change belongs to this ticket.

## Parent

[Design System Foundation spec](../spec.md). This ticket extends the original three-reference scope with an additional user-approved reference; the original foundation tickets remain unchanged.
