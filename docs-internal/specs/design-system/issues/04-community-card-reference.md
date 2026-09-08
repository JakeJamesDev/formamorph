# 04: Add the Community Card Reference

Status: ready-for-human
Blocked by: 02 — Build the Settings Reference Showcase
Recommended model: GPT-5.6 Terra (`gpt-5.6-terra`)
Reasoning effort: high

**Model rationale:** This is a bounded reuse slice once the showcase foundation exists: production cards, controlled fixtures, guide coverage, and visual checks. This is a workload recommendation, not a ticket-specific benchmark or an automatic model switch. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A reviewer can inspect production community creation cards in the showcase with realistic content, metadata, tags, and secondary-action states.

## Acceptance Criteria

- [x] Add community creation card examples using the production card, card shell, and existing shared elements; do not recreate their markup as decorative examples.
- [x] Preserve image-led composition, readable title treatment, description hierarchy, counts, tags, and secondary-action placement.
- [x] Use neutral, controlled fixtures with realistic descriptions, long titles, and enough tags to expose wrapping and overflow behavior.
- [x] Demonstrate applicable selected, disabled, focus, overflow, and action states through controlled callbacks; do not publish, download, delete, like, or change real community data.
- [x] Document the card composition/density pattern, component mapping, state behavior, and mobile adaptation.
- [x] Verify desktop/mobile and light/dark appearances with static evidence, including title readability and representative palette/font inheritance.
- [x] Retain relevant existing card behavior coverage and add only tests justified by meaningful new behavior or regression risk.
- [x] Pass all four gates, report test duration, update the knowledge graph, and add the appropriate In-Progress changelog entry.

## Verification

Use existing card behavior seams and controlled fixtures, then inspect hierarchy, title treatment, tags, counts, secondary actions, focus, and long-content layouts in the live showcase.

## Coordination and Scope

Can proceed alongside 03 after 02, subject to shared-file coordination. If reuse reveals a broad refactor, surface it rather than expanding the ticket; Sol is an appropriate escalation for a materially harder implementation.

Follow the confirmed foundation scope: no app-wide redesign, palette replacement, bulk copy rewrite, version bump, or export-shape change.

## Parent

[Design System Foundation spec](../spec.md)

## Comments

### Integration verification — September 8, 2026

Ticket 05 completed the missing light-theme verification for the production-backed card reference, alongside desktop/mobile, dark, inherited purple/Lexend styling, local pending/completed actions, and keyboard focus. See the [workflow review](../../../designs/design-system/workflow-review.md) for evidence and copy-review limits. The user approved committing tickets 04 and 05 together. The combined changelog entry is in In Progress; released history is preserved.
