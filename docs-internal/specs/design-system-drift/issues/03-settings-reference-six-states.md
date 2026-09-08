# 03: Label Default and Selected in the Settings reference

Status: ready-for-human
Base: c87369b8
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

A small showcase addition using production rows and controls. No production settings surface changes.

## Parent

[spec.md](../spec.md), item 4.

## What to build

An agent who opens the live Settings reference sees six labeled state examples, matching the guide's state table: Default, Selected, Disabled, Focus, Validation, Overflow. The two new examples:

- **Default** shows a row with a valid initial value, the normal border, and the normal text roles.
- **Selected** shows an option switcher with one selected segment using the production selected fill, foreground, and shadow.

Both reuse the production settings rows and controls. The registry entry and its description do not change. The reference keeps its local demonstration state and calls no endpoint.

## Acceptance criteria

- [ ] The Settings reference renders labeled Default and Selected examples.
- [ ] The Selected example's segmented control reports exactly one selected item.
- [ ] The existing four labeled states remain and keep their order relative to the guide table.
- [ ] Both examples render at desktop and mobile widths without horizontal page overflow.
- [ ] The showcase suite asserts the two new labels and the selected count, and fails when either example is removed.
- [ ] The four gates pass. One In Progress changelog entry in the dev-tooling bucket, or share the entry with ticket 02.

## Blocked by

- None — can start immediately.
