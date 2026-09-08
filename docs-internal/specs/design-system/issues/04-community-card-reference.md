# 04: Add the Community Card Reference

Status: ready-for-agent
Blocked by: 02 — Build the Settings Reference Showcase
Recommended model: GPT-5.6 Terra (`gpt-5.6-terra`)
Reasoning effort: high

**Model rationale:** This is a bounded reuse slice once the showcase foundation exists: production cards, controlled fixtures, guide coverage, and visual checks. This is a workload recommendation, not a ticket-specific benchmark or an automatic model switch. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A reviewer can inspect production community creation cards in the showcase with realistic content, metadata, tags, and secondary-action states.

## Acceptance Criteria

- [ ] Add community creation card examples using the production card, card shell, and existing shared elements; do not recreate their markup as decorative examples.
- [ ] Preserve image-led composition, readable title treatment, description hierarchy, counts, tags, and secondary-action placement.
- [ ] Use neutral, controlled fixtures with realistic descriptions, long titles, and enough tags to expose wrapping and overflow behavior.
- [ ] Demonstrate applicable selected, disabled, focus, overflow, and action states through controlled callbacks; do not publish, download, delete, like, or change real community data.
- [ ] Document the card composition/density pattern, component mapping, state behavior, and mobile adaptation.
- [ ] Verify desktop/mobile and light/dark appearances with static evidence, including title readability and representative palette/font inheritance.
- [ ] Retain relevant existing card behavior coverage and add only tests justified by meaningful new behavior or regression risk.
- [ ] Pass all four gates, report test duration, update the knowledge graph, and add the appropriate In-Progress changelog entry.

## Verification

Use existing card behavior seams and controlled fixtures, then inspect hierarchy, title treatment, tags, counts, secondary actions, focus, and long-content layouts in the live showcase.

## Coordination and Scope

Can proceed alongside 03 after 02, subject to shared-file coordination. If reuse reveals a broad refactor, surface it rather than expanding the ticket; Sol is an appropriate escalation for a materially harder implementation.

Follow the confirmed foundation scope: no app-wide redesign, palette replacement, bulk copy rewrite, version bump, or export-shape change.

## Parent

[Design System Foundation spec](../spec.md)
