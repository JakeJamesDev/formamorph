# 02: Requires field in the editor

Status: ready-for-human
Status note: built in f21bfa85 and 394da2d5; open calls under Comments.
Base: 9ab25d6d
Blocked by: 01 — Gate module and enter-world gates
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: editor UI on an existing panel and tree with the trait manager's component tests as prior art; the logic already lives in the gate module.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

An author gives a trait requirements from the trait panel, reads the rule at a glance as chips joined by "or", follows a chain by clicking a chip, and sees which tree rows are gated without opening each one.

## Acceptance criteria

- [x] The trait panel's Details tab gains a **Requires** field with the hint "Available when any one of these holds". Chips join with "or" and each has a remove button.
- [x] **Add Requirement** opens a searchable picker in three sections: Traits, Any Trait in a Group, Playing As. Each row shows where its target lives, such as "Ash › Bond", and an owned trait reads with its owner, such as "Ash's Tamed".
- [x] Clicking a requirement chip opens the target trait.
- [x] A gated tree row shows a lock and the requirement count, with the full rule as a tooltip. An unresolved requirement tints the row and its chip red, and the chip still shows the stored name.
- [x] A deleted target leaves its dependents locked, never open.
- [x] Component tests cover the Requires field: add, remove, chip click, the unresolved tint.
- [x] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [x] State every export-shape change in the response.
- [x] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.

## Comments

**Hand-over (2026-09-26).** The field is `src/components/editor/TraitRequiresField.tsx`; picker rows come from `requirementOptions` in `src/lib/traitGates.ts`.

- **Calls made without a ruling:** the picker leaves out the trait, its exclusive siblings, and a group holding only those. Group chips open the group; playing-as chips open the entity on the Entities tab (the prototype opened trait chips only). Persona rows show "Persona" as where they live.
- **Copy flag:** the standards review says the hint "Available when any one of these holds" fails the Writing Guide's verb-first help-line test. It is the ticket's own wording, so it shipped as written.
- **Ticket 06:** `requirementOptions` already labels owned traits "Ash's Tamed" at "Ash › Bond"; the editor only needs to pass entity owners into its gate input.
