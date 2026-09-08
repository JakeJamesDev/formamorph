# 03: Add the Markdown Editing Reference

Status: ready-for-agent
Blocked by: 02 — Build the Settings Reference Showcase
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

**Model rationale:** Preserve selection-sensitive editing behavior while integrating the real toolbar and any minimal reuse refactor. This is a workload recommendation, not a ticket-specific benchmark or an automatic model switch. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A reviewer can use the production markdown editor in the showcase and inspect the approved toolbar, split buttons, and Edit/Preview behavior against documented patterns.

## Acceptance Criteria

- [ ] Add a working markdown editing example to the existing showcase using the real production editor and toolbar.
- [ ] Preserve compact tool groups, vertical separators, split-button current actions and dropdown choices, and clear Edit/Preview selection.
- [ ] Preserve selected-text formatting and editor selection when using toolbar controls. Demonstration edits remain local.
- [ ] Reuse the editor as a whole where sufficient. If an internal control must be exposed, prefactor it before showcase integration, keep production callers on the same behavior, and avoid a broad toolbar redesign.
- [ ] Document the markdown composition and density pattern, component mapping, tool grouping, split-button behavior, and mobile adaptation.
- [ ] Include realistic long content and applicable selected, disabled, focus, and overflow states; demonstrate actual formatting and rendered preview.
- [ ] Verify the reference in desktop/mobile and light/dark appearances using static evidence, with reduced-motion behavior respected where affected.
- [ ] Retain relevant existing formatting, preview, history, fullscreen, and selection-related coverage; add tests only for meaningful behavior or regression risk introduced by the change.
- [ ] Pass all four gates, report test duration, update the knowledge graph, and add the appropriate In-Progress changelog entry.

## Verification

Exercise selected-text formatting, split-button action and dropdown, and Edit/Preview through the actual editor. Use existing component behavior seams plus live showcase verification; DOM structure alone is not visual proof.

## Coordination and Scope

Can proceed alongside 04 after 02, subject to coordination of shared showcase registration and guide edits. Does not depend on 01; final functional-copy reconciliation belongs to 05.

Follow the confirmed foundation scope: no app-wide redesign, palette replacement, bulk copy rewrite, version bump, or export-shape change.

## Parent

[Design System Foundation spec](../spec.md)
