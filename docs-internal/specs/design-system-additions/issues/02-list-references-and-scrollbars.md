# 02: Showcase List Densities And Standardize Scrollbars

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

## What to build

Add production-backed World Editor and Save/Load list references that demonstrate why lists with useful controls or metadata need a different composition from simple compact pickers. Publish the shared scrollbar standard and bring these reference surfaces into alignment.

## Model rationale

Sol is recommended for the bounded component-reuse and documentation work. High effort supports preserving existing list behavior, inspecting specialized scrolling, and verifying responsive references without turning the task into a broad refactor.

## Acceptance criteria

- [ ] Provide realistic World Editor and Save/Load list examples using production components and controlled local fixtures/callbacks. Preserve useful metadata, selection, and existing actions; do not replace them with decorative lookalikes.
- [ ] Demonstration editing, sorting where already present, save actions, and deletion affect only isolated sample state. The showcase must not load/delete real saves or change authored worlds.
- [ ] Document richer rows separately from compact selection rows. Density follows actual content and controls. Do not force every list to use a 56px editor floor, remove meaningful controls to fit the compact pattern, or add sorting to a simple chooser.
- [ ] Apply the World Editor scrollbar appearance to the scoped references: 10px vertical track, rounded theme-derived thumb, no up/down chevrons, and enough gutter to avoid obscuring content.
- [ ] Reuse shared scroll-area behavior where suitable. Preserve specialized editor selection and scrolling, horizontal scrolling where required, wheel/touch/keyboard access, and focus reveal. Do not introduce nested scroll containers merely to imitate styling.
- [ ] Bound long list panes and keep relevant search/footer controls reachable outside scrolling content. Exercise long labels and realistic metadata rather than shortening fixtures to hide overflow.
- [ ] Add guide sections with production mappings, density-selection guidance, applicable states, and explicit mobile adaptations. Add the two production-backed references to the existing dev-only showcase.
- [ ] Inspect desktop/mobile layouts in both themes and representative font/palette settings. Verify selected, disabled, focus, long-content, and overflow behavior applicable to each source.
- [ ] Publish an actionable inventory of other scrollbar/list alignment needs, grouped by surface and observed limitation. Distinguish native/specialized scrollers from shared ones; do not silently migrate them in this ticket.
- [ ] Confirm the existing design-system skill discovers the additions through the guide. Modify its workflow only for a demonstrated gap, without duplicating component values.
- [ ] Review new functional copy through the Writing Guide and preserve authored fixture voices. Record unresolved STE limits.
- [ ] Pass typecheck, lint, tests, build, and live UI verification. Time tests, apply the project test-quality requirements, update the code graph after changes, and add the appropriate In-Progress changelog entry.

## Verification

Prefer existing editor-row, Save/Load, shared-scroll-area, and dev-route seams. Test meaningful action outcomes and showcase isolation; retain coverage for scrolling marks and other existing behavior where affected. Static screenshots and DOM measurements support visual review but do not establish visual quality alone.

Exercise long lists, narrow widths, enlarged text, keyboard navigation, and independent pane scrolling. Verify arrow controls are absent in the target rendering environment and document platform limitations. No markup-mirroring tests or fixture reductions to hide failures.

## Coordination and scope

Independent of ticket 01 because the richer production lists and shared scrollbar already exist. Coordinate shared guide/showcase edits and any necessary scrollbar changes with the picker work. Reuse or integrate ongoing Enter World row work rather than creating a second row system. Ticket 01 owns the new compact picker; ticket 03 owns footer-order guidance.

No app-wide scrollbar replacement, bulk list redesign, save/export migration, new sorting feature, version bump, or reopening completed reference tickets.

## Parent

[Design Standards Additions](../spec.md).