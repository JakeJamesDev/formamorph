# 06: Add the Find Bar Reference

Status: in-progress
Blocked by: None (can start immediately)
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

**Model rationale:** A bounded integration of the production search control, realistic local editing state, guide coverage, and keyboard verification. This is a workload recommendation, not a model switch or ticket-specific benchmark. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A reviewer can use the World Editor Find bar against an isolated sample document and inspect the compact utility-bar pattern in the live design showcase.

## Acceptance Criteria

- [ ] Add the actual World Editor Find bar to the existing development-only showcase with realistic local searchable content and visible navigation/replacement outcomes.
- [ ] Preserve joined input/options, case and whole-word controls, expandable Replace row, separate previous/next actions, and close behavior. Document the pattern's purpose, compact density, production mapping, and grouping rules.
- [ ] Demonstrate an empty query, matches, no matches, option selection, navigation boundaries, expanded/collapsed replacement, and applicable disabled and focus states.
- [ ] Exercise Find and Replace through real production behavior and controlled callbacks. Sample replacements must never modify an authored world, persistent user data, or the clipboard without an explicit action.
- [ ] Preserve existing keyboard and replacement confirmation behavior; verify accessible names and focus after expansion, navigation, and closing.
- [ ] Add desktop/mobile guidance and static evidence in representative editor context, including long input and narrow layouts. Reuse theme and typography values across both light/dark appearances and representative font/palette choices.
- [ ] Review new functional descriptions, control names, and status text through the Writing Guide; record evidence limits for reused production copy.
- [ ] Keep the guide section and showcase registry synchronized and reachable through the current design-system skill; change the skill only if a demonstrated workflow gap requires it.
- [ ] Retain existing Find bar behavior tests and add meaningful guards for integration or isolation risks. Pass all four gates, time tests, update the knowledge graph after code changes, and add an In-Progress changelog entry.

## Verification

Use the existing Find bar tests and a real local sample to verify matching, navigation, options, replacement, and keyboard outcomes. Inspect static desktop/mobile frames and DOM evidence; do not treat a screenshot as behavioral proof.

## Coordination and Scope

The existing design-system foundation is the prerequisite already supplied. Tickets 06, 07, and 08 have no new blocking edges between them; coordinate shared guide and showcase registry edits before concurrent work.

The user approved this existing UI as an additional starting reference and approved the three-ticket extension. Preserve the reference's composition without treating every existing flaw as a new standard. Name adjacent defects rather than silently redesigning the surface. No app-wide redesign, new palette, bulk copy rewrite, version bump, or export-shape change belongs to this ticket.

## Parent

[Design System Foundation spec](../spec.md). This ticket extends the original three-reference scope with an additional user-approved reference; the original foundation tickets remain unchanged.
