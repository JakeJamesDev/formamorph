# 02: Build the Settings Reference Showcase

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

**Model rationale:** Build the first integrated UI slice across dev routing, production components, state isolation, documentation, and visual verification. This is a workload recommendation, not a ticket-specific benchmark or an automatic model switch. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A reviewer can open a dev-only Formamorph showcase directly and inspect working Settings Display and Output reference patterns alongside their guide.

## Acceptance Criteria

- [ ] Create the authoritative visual guide and a development-only showcase reachable through the existing dev router; verify the showcase does not become a production surface.
- [ ] Render representative Display and Output compositions using actual production settings controls, shared rows, typography, and theme values. Do not copy production markup into a separate styling system.
- [ ] Document visual foundations and a named settings layout/density pattern, its purpose, production component mapping, and responsive adaptations.
- [ ] Keep established section dividers, label/control alignment, widget variety, concise descriptions, and optional information behavior.
- [ ] Expose applicable default, selected, disabled, focus, validation, and overflow examples with realistic content; unsupported states need not be invented.
- [ ] Demonstrate working checkboxes, sliders, selects, segmented options, and information controls. Keep demonstration state local or isolated so it does not change persistent user settings or trigger model/network work.
- [ ] Preserve existing mobile adaptations, supported light/dark appearances, palettes, and font choices. Use source theme values rather than sampling HDR screenshots.
- [ ] Establish a small extension point for the markdown and card references so later tickets add their own examples and guide sections without redesigning the showcase.
- [ ] Perform only necessary prefactoring before wiring reused compositions; preserve current production behavior. New visual patterns still require user approval in app context.
- [ ] Pass the implementation completion checks and record the slice in the In-Progress changelog.

## Verification

Use the existing dev-router guard and settings behavior/alignment seams. Verify desktop/mobile, light/dark, focus, overflow, and representative palette/font inheritance in the live preview using static evidence. Run all four gates, time tests, and update the knowledge graph after code changes.

## Coordination and Scope

Can proceed alongside 01 using existing settings copy; do not claim STE compliance for reused copy. Ticket 05 reconciles the showcase with 01. Coordinate shared guide edits if both run concurrently.

Follow the confirmed foundation scope: no app-wide redesign, palette replacement, bulk copy rewrite, version bump, or export-shape change.

## Parent

[Design System Foundation spec](../spec.md)
