# 02: Requires field in the editor

Status: ready-for-agent
Blocked by: 01 — Gate module and enter-world gates
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: editor UI on an existing panel and tree with the trait manager's component tests as prior art; the logic already lives in the gate module.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

An author gives a trait requirements from the trait panel, reads the rule at a glance as chips joined by "or", follows a chain by clicking a chip, and sees which tree rows are gated without opening each one.

## Acceptance criteria

- [ ] The trait panel's Details tab gains a **Requires** field with the hint "Available when any one of these holds". Chips join with "or" and each has a remove button.
- [ ] **Add Requirement** opens a searchable picker in three sections: Traits, Any Trait in a Group, Playing As. Each row shows where its target lives, such as "Ash › Bond", and an owned trait reads with its owner, such as "Ash's Tamed".
- [ ] Clicking a requirement chip opens the target trait.
- [ ] A gated tree row shows a lock and the requirement count, with the full rule as a tooltip. An unresolved requirement tints the row and its chip red, and the chip still shows the stored name.
- [ ] A deleted target leaves its dependents locked, never open.
- [ ] Component tests cover the Requires field: add, remove, chip click, the unresolved tint.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
