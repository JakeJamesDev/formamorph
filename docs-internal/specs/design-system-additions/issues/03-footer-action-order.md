# 03: Establish Negative-Then-Positive Footer Actions

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: medium

## What to build

Make the established negative-left, positive-right button convention explicit and verifiable through production-backed footer examples. Demonstrate ordinary acceptance and destructive confirmation without changing unrelated app dialogs.

## Model rationale

Sol at medium effort is recommended for this narrow composition, documentation, and verification slice. Existing footer primitives provide the behavior; the work is to make their intended use clear and check responsive ordering and action semantics.

## Acceptance criteria

- [x] Document negative | positive as the paired-action rule: Cancel or decline on the left, acceptance or continuation on the right. Keep the pair together in the footer action area.
- [x] Provide production-backed, isolated showcase examples for ordinary acceptance and destructive confirmation, using the existing dialog/footer controls. Show Cancel | Create Group and Cancel | Delete or equivalent established production actions.
- [x] Preserve destructive styling on a destructive affirmative action; do not interpret positive placement as a requirement for a non-destructive color or change its confirmation semantics.
- [x] Demonstrate the current mobile adaptation: affirmative above Cancel when the shared footer stacks, and negative-left/positive-right when horizontal. Verify visible placement and coherent keyboard order at both sizes.
- [x] Examples show enabled/disabled acceptance, keyboard focus, cancellation with no mutation, and confirmation changing only local sample state. Closing returns focus to a valid opener.
- [x] Add the guide rule, production mapping, examples, states, and responsive behavior together. Ensure the established project-skill workflow leads to this reference without copying styling values into the skill.
- [x] Inventory existing footer-order violations for focused follow-up. Correct only the scoped showcase/source issues necessary to deliver this ticket; do not globally reorder every dialog or unrelated toolbar.
- [x] Preserve existing button labels and operation semantics unless the scoped example requires new copy. Review new functional text separately through the Writing Guide and record limitations.
- [x] Verify both themes, representative font/palette inheritance, desktop/mobile widths, long labels, and enlarged text. Footer controls must remain reachable without forcing horizontal page overflow.
- [x] Pass typecheck, lint, tests, build, and live UI verification. Time test runs, use meaningful behavioral assertions, refresh the code graph after changes, and add the appropriate In-Progress changelog entry.

## Verification

Use existing dialog and confirmation behavior seams plus the production-backed showcase. Check cancellation, confirmation, disabled acceptance, keyboard activation, focus return, and isolated callbacks. Confirm visual left/right and stacked order using static frames and DOM evidence. Do not treat DOM source order alone as proof of the rendered layout.

## Coordination and scope

Independent of tickets 01 and 02: existing shared footer controls are sufficient, and the convention is already approved. Ticket 01 applies the rule directly in its group flow; it does not need to wait for this documentation/reference slice. Coordinate shared guide and registry edits, and avoid a second implementation of picker-specific behavior.

No broad footer migration, color-system change, new dialog architecture, version bump, or export change. Inventory unrelated violations instead of fixing them in this slice.

## Parent

[Design Standards Additions](../spec.md).
