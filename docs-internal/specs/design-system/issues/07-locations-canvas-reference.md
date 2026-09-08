# 07: Add the Locations Canvas Reference

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

**Model rationale:** The spatial editor has nested state, history, preferences, and context dependencies; isolation and faithful interaction require broader reasoning. This is a workload recommendation, not a model switch or ticket-specific benchmark. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A reviewer can explore a real Locations Canvas with nested Groups and Connections, inspect its spatial-workspace pattern, and perform local interactions without changing a saved world.

## Acceptance Criteria

- [x] Add the production Locations Canvas to the existing development-only showcase using neutral sample locations with nested Groups, child locations, and representative directed Connections and labels.
- [x] Document the spatial-workspace pattern: bounded work area, nested containment, connection hierarchy, floating tool groups, search, zoom/fit controls, minimap, and density. Preserve the domain distinction between Group containment and authored Connections.
- [x] Isolate world state, history, and canvas preferences from real authored data and saved preferences. Confirm how context and storage dependencies behave before reuse; perform only necessary prefactoring before integrating the sample.
- [x] Preserve manual layout and Auto Arrange semantics. Demonstrate search/reveal, selection, pan/zoom/fit, a local movement or arrangement, and undo/redo where applicable; do not introduce automatic persistent layout changes.
- [x] Expose representative selected, disabled, focus, and overflow states with long names and connection labels. Keep the sample realistic enough to reveal hierarchy and overlap issues.
- [x] Preserve current production drag, connection, and nesting behavior and applicable architecture decisions. Do not redesign the graph, change travel rules, or widen this ticket into a canvas refactor.
- [x] Verify in a realistically sized editor context at desktop and mobile widths with static frames and structural evidence, both light/dark appearances, and representative font/palette inheritance. Respect reduced motion and existing touch behavior.
- [x] Record responsive adaptations and any unresolved production limitation explicitly. User approval covers the existing reference; any newly needed visual pattern must be proposed before adoption.
- [x] Review new functional toolbar names, descriptions, and status messages through the Writing Guide; sample authored location names retain their own voice.
- [x] Keep guide, showcase registry, and skill discovery aligned. Retain existing canvas behavior and dev-route coverage; add meaningful isolation/integration guards where needed.
- [x] Pass all four gates, time tests, update the knowledge graph after code changes, and add an In-Progress changelog entry.

## Verification

Use existing canvas behavior seams for state-changing actions and live preview for layout, hierarchy, controls, and accessibility. Prove demonstration actions remain local and history restores local changes. Do not rely on hidden-tab animation timing or strip the fixture to conceal overflow.

## Coordination and Scope

The existing design-system foundation is the prerequisite already supplied. Tickets 06, 07, and 08 have no new blocking edges between them; coordinate shared guide and showcase registry edits before concurrent work.

The user approved this existing UI as an additional starting reference and approved the three-ticket extension. Preserve the reference's composition without treating every existing flaw as a new standard. Name adjacent defects rather than silently redesigning the surface. No app-wide redesign, new palette, bulk copy rewrite, version bump, or export-shape change belongs to this ticket.

## Parent

[Design System Foundation spec](../spec.md). This ticket extends the original three-reference scope with an additional user-approved reference; the original foundation tickets remain unchanged.

## Comments

### Implementation and verification

- Added the production canvas through a narrow controlled workspace boundary. Sample world arrays, canvas history, and preferences are local; production retains its authored-world adapter and persistent preferences.
- Added the Locations registry entry, Bounded Spatial Workspace guide, and an update to the existing In-Progress Design System changelog entry. The existing design-system skill discovers it through the guide.
- [Review and evidence](../../../designs/design-system/locations-canvas-review.md) records state ownership, responsive behavior, writing limits, scoped coverage, mutation checks, and browser captures.
- Typecheck **0 errors**; lint **0 errors**; full suite **8,590 passed, 3 skipped**, exit 0, **62.14 seconds**; production build **succeeded** (18.72 seconds). Showcase-specific names are absent from production JavaScript.
- Focused suite **143 passed** (7.01 seconds); existing canvas browser regressions **5 desktop + 2 mobile passed** (27.25 + 13.53 seconds). Reference interactions passed at desktop/mobile widths (13.06 seconds), both themes, Purple/Atkinson inheritance, and reduced motion.
- All three isolation regressions were deliberately reintroduced, caught, and restored. Final two-axis review has no remaining substantive findings.
- Existing limitations remain explicit: phone fit overview density, overlapping Connection labels, Group interception of covered Connection segments, and the floating inspector covering some narrow-screen controls. The shared tab-label overlap discovered here is corrected by ticket 09's responsive shell change.
- World/save export shape, version, and preference defaults are unchanged. No model endpoint or download is involved.
- Knowledge graph update completed with exit 0; no topology changes remained.
- Pre-commit gate refresh after ticket 08: **8,595 tests passed, 3 skipped**, exit 0, **61.79 seconds**; lint and build passed. Ticket 09 corrected its new test's unsupported role-query option before the final typecheck.
