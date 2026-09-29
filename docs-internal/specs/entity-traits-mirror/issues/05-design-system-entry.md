# 05: Design-System entry and showcase for stacked list-and-detail

Status: ready-for-agent
Blocked by: 04 — The mirror; 07 — Inline back arrow and a collapsed mobile chip strip
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: documentation and a showcase reference over a finished component, with the design-system skill's checklist as the bar.

Parent: [Entity Traits Mirror spec](../spec.md)

## What to build

The stacked list-and-detail inside an entity panel is recorded as an approved visual pattern. A reader of the Design System finds the pattern, where it is used, and its rules, and the dev-router showcase renders a reference of it. Lands after the user approves the pattern on screen.

## Acceptance criteria

- [ ] The user has approved the stacked pattern from static frames of ticket 07 before this ticket edits the Design System.
- [ ] The Design System gains an entry for stacked list-and-detail: purpose, when to use it over side by side, the inline back arrow (Q33–Q36), the toolbar staying in place, and the reduced-motion rule.
- [ ] The showcase gains a reference for the pattern with a dev-route entry, following the design-system skill's reference conventions.
- [ ] The entry's usage table lists the entity **Traits** tab and the mobile push as the places it appears.
- [ ] Copy follows the Writing Guide and passes the copy sweep.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] No export-shape change; say so in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
