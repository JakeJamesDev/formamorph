# 04: Always On traits

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a new activation source inside the settle fixpoint, with cascade, return and pick-count interactions.

Parent: [Trait Modes and Pick Counts spec](../spec.md)

## What to build

An author can mark a trait Always On. It is active exactly when its gate holds, and always when it has no requirements (Q2). The player can never switch it. A curse is an Always On trait that requires a cursed item: picking the item brings the curse, and dropping the item lifts it. While its gate doesn't hold, the trait is not shown (Q15). While active, it shows checked with no control. It counts toward its group's min and max (Q8). In a max-1 group, an active Always On trait can't be swapped out.

## Acceptance criteria

- [ ] `Trait` has `mode?: 'alwaysOn' | 'hidden'`, and absent means Optional (Q17). This ticket implements `alwaysOn`. This is a world export shape change.
- [ ] Settle treats every Always On trait whose gate holds as proposed. When its gate fails, it leaves like a cascade-off trait and returns through the same path.
- [ ] The gate module refuses to switch an Always On trait in either direction. It also refuses a max-1 swap that would retire an Always On sibling.
- [ ] Default selection includes active Always On traits and counts them toward the max. `isDefault` and `playerToggle` are ignored for a non-Optional mode.
- [ ] The trait editor has a mode control, Optional / Always On (Q18). Always On hides the Default and Player Can Toggle fields.
- [ ] The setup list and the Traits tab hide a dormant Always On trait. They show an active one checked with no control.
- [ ] Test Bench rule `trait-group-always-on-over-max` (warning): Always On traits that can be active together exceed the group's max, per bearer.
- [ ] The same behavior holds for entity-owned traits (Q11).
- [ ] Tests: the curse chain on and off, with its return; switch refusals; the counts toward min and max; the max-1 refusal; dormant and active rendering; the new rule. Each guard is shown to bite.
- [ ] The changelog line is in In Progress. The response carries the export-shape reminder.
