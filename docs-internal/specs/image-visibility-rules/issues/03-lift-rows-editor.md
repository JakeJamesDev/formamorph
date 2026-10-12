# 03: Lift the rows editor off the trait

Status: done
Blocked by: none
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a prefactor with no behavior change. Move a component's data source from a trait and its store to props, keep the existing tests green.

Parent: [Image Visibility Rules spec](../spec.md)

## What to build

The Requires field today takes a trait and reads the trait store. Ticket 08 needs the same rows editor on a gallery image, which has no trait. Lift the editor into a component shaped on rows plus an owner (the bearer the rows default to), and mount it from the Availability tab with no visible change.

- The Availability tab renders, edits and summarizes exactly as before.
- The lifted component takes rows, an owner and an on-change callback. The trait-bound wrapper feeds it from the store.
- The Add Requirement, And, Or Another Way and Not interactions keep their tests.

## Acceptance criteria

- [ ] Every existing Requires field and Availability rule test passes unchanged or with only import changes.
- [ ] The lifted component has one test mounting it with no trait and no store.
- [ ] A dev-router showcase entry or the existing Availability tab route still renders the field.
- [ ] No changelog entry (no user-visible change). Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
