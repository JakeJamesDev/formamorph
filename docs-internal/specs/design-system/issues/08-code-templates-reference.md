# 08: Add the Code Templates Reference

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

**Model rationale:** Integrate the production dialog while preserving validation and code generation and isolating template storage and file actions. This is a workload recommendation, not a model switch or ticket-specific benchmark. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A reviewer can choose a stat Code Template, edit its parameters, inspect validation and generated code, and observe local insertion in the showcase.

## Acceptance Criteria

- [x] Add the actual stat Code Templates dialog to the existing development-only showcase with neutral sample stats and controlled template data.
- [x] Document the selection-and-detail pattern: categorized sidebar, selected item, heading and explanation, parameter form, inline validation, generated code preview, and footer actions. Map the pattern to production components and describe its density.
- [x] Demonstrate built-in template selection, required stat inputs, numeric parameters, missing/invalid and valid states, generated code updates, disabled/enabled insertion, keyboard focus, and long-content overflow where applicable.
- [x] Capture Insert Code in a local sample target so the action has a visible result without modifying an authored world. Keep the real template validation and generation behavior.
- [x] Isolate personal-template reads/writes and any duplication, import/export, or deletion behavior from the user's template library and files. Use local demonstration adapters where needed; never silently invoke real storage or downloads.
- [x] Before showcase integration, perform only the minimal prefactoring needed for production-backed isolated dependencies. Preserve existing production storage and dialog behavior.
- [x] Verify desktop/mobile composition and dialog scrolling with static frames and DOM evidence, both light/dark appearances, and representative font/palette inheritance.
- [x] Review functional labels, explanations, validation, and action messages with the Writing Guide. Do not change code tokens or stat sandbox semantics to satisfy prose rules.
- [x] Keep the guide section, showcase registry, and design-system skill discovery aligned. Any new visual departure from the approved reference needs a contextual proposal before adoption.
- [x] Retain existing dialog/template behavior tests and add meaningful guards for local insertion or storage isolation as warranted. Pass all four gates, time tests, update the knowledge graph after code changes, and add an In-Progress changelog entry.

## Verification

Exercise actual template selection, slot validation, generated output, and local insertion through the dialog. Verify invalid input prevents insertion and completing inputs enables it. Inspect keyboard and responsive behavior; prove showcase interactions do not write the real template library.

## Coordination and Scope

The existing design-system foundation is the prerequisite already supplied. Tickets 06, 07, and 08 have no new blocking edges between them; coordinate shared guide and showcase registry edits before concurrent work.

The user approved this existing UI as an additional starting reference and approved the three-ticket extension. Preserve the reference's composition without treating every existing flaw as a new standard. Name adjacent defects rather than silently redesigning the surface. No app-wide redesign, new palette, bulk copy rewrite, version bump, or export-shape change belongs to this ticket.

## Parent

[Design System Foundation spec](../spec.md). This ticket extends the original three-reference scope with an additional user-approved reference; the original foundation tickets remain unchanged.

## Comments

### Implementation review — September 8, 2026

- Added the production stat Code Templates dialog to the showcase with neutral stats, an in-memory personal-template repository, controlled import/export text, and a visible local insertion target. Production callers keep the existing storage and download defaults.
- Preserved real parsing, defaults, validation, generated code, ownership actions, and confirmations. Browser verification caught a stale-state race between quick consecutive slot selections; functional state updates now preserve both choices without weakening validation or adding delays.
- Documented the selection-and-detail pattern and reviewed its new functional copy in the [Code Templates review](../../../designs/design-system/code-templates-review.md). The review inventories unresolved STE limits rather than claiming full compliance.
- Focused tests passed 16/16 in 5.39 seconds. Narrow coverage passed nine tests in 6.81 seconds with 94.69% statement/line, 77.35% branch, and 84.21% function coverage across the two touched components. Adapter-list, local-insertion, and validation-description mutations each failed their guard before restoration.
- The real browser spec passed 6/6 desktop/mobile checks in 23.63 seconds. Four isolated static runs passed in 11.65 seconds at 1280×860 and 375×812 in light/dark; DOM evidence confirmed focus containment, no horizontal overflow, viewport-bounded shells, Lexend inheritance, and 790 px of long mobile detail scrolling inside a 570 px pane. Captures: `.scratch/design-system-code-templates/`.
- Final gates passed: typecheck in 12.92 seconds, lint in 12.99 seconds, 8,590 tests with three skipped in 57.05 seconds, and production build in 15.56 seconds. Aggregate test execution was 363.55 seconds across workers, so the wall time showed no idle-tail gap.
- The two-axis fixed-point review found no spec gaps, scope creep, implementation errors, or baseline smells. Its only standards finding was this ticket's stale `in-progress` status, corrected in this handoff.
- The knowledge graph update completed with only the three existing Gradle parser warnings. No version, settings default, world/save export shape, authored world, personal template library, or user file changed.
