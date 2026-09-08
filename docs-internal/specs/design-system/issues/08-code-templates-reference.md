# 08: Add the Code Templates Reference

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

**Model rationale:** Integrate the production dialog while preserving validation and code generation and isolating template storage and file actions. This is a workload recommendation, not a model switch or ticket-specific benchmark. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A reviewer can choose a stat Code Template, edit its parameters, inspect validation and generated code, and observe local insertion in the showcase.

## Acceptance Criteria

- [ ] Add the actual stat Code Templates dialog to the existing development-only showcase with neutral sample stats and controlled template data.
- [ ] Document the selection-and-detail pattern: categorized sidebar, selected item, heading and explanation, parameter form, inline validation, generated code preview, and footer actions. Map the pattern to production components and describe its density.
- [ ] Demonstrate built-in template selection, required stat inputs, numeric parameters, missing/invalid and valid states, generated code updates, disabled/enabled insertion, keyboard focus, and long-content overflow where applicable.
- [ ] Capture Insert Code in a local sample target so the action has a visible result without modifying an authored world. Keep the real template validation and generation behavior.
- [ ] Isolate personal-template reads/writes and any duplication, import/export, or deletion behavior from the user's template library and files. Use local demonstration adapters where needed; never silently invoke real storage or downloads.
- [ ] Before showcase integration, perform only the minimal prefactoring needed for production-backed isolated dependencies. Preserve existing production storage and dialog behavior.
- [ ] Verify desktop/mobile composition and dialog scrolling with static frames and DOM evidence, both light/dark appearances, and representative font/palette inheritance.
- [ ] Review functional labels, explanations, validation, and action messages with the Writing Guide. Do not change code tokens or stat sandbox semantics to satisfy prose rules.
- [ ] Keep the guide section, showcase registry, and design-system skill discovery aligned. Any new visual departure from the approved reference needs a contextual proposal before adoption.
- [ ] Retain existing dialog/template behavior tests and add meaningful guards for local insertion or storage isolation as warranted. Pass all four gates, time tests, update the knowledge graph after code changes, and add an In-Progress changelog entry.

## Verification

Exercise actual template selection, slot validation, generated output, and local insertion through the dialog. Verify invalid input prevents insertion and completing inputs enables it. Inspect keyboard and responsive behavior; prove showcase interactions do not write the real template library.

## Coordination and Scope

The existing design-system foundation is the prerequisite already supplied. Tickets 06, 07, and 08 have no new blocking edges between them; coordinate shared guide and showcase registry edits before concurrent work.

The user approved this existing UI as an additional starting reference and approved the three-ticket extension. Preserve the reference's composition without treating every existing flaw as a new standard. Name adjacent defects rather than silently redesigning the surface. No app-wide redesign, new palette, bulk copy rewrite, version bump, or export-shape change belongs to this ticket.

## Parent

[Design System Foundation spec](../spec.md). This ticket extends the original three-reference scope with an additional user-approved reference; the original foundation tickets remain unchanged.
