# 04: Always On traits

Status: ready-for-human
Base: ec0a3fe9
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a new activation source inside the settle fixpoint, with cascade, return and pick-count interactions.

Parent: [Trait Modes and Pick Counts spec](../spec.md)

## What to build

An author can mark a trait Always On. It is active exactly when its gate holds, and always when it has no requirements (Q2). The player can never switch it. A curse is an Always On trait that requires a cursed item: picking the item brings the curse, and dropping the item lifts it. While its gate doesn't hold, the trait is not shown (Q15). While active, it shows checked with no control. It counts toward its group's min and max (Q8). In a max-1 group, an active Always On trait can't be swapped out.

## Acceptance criteria

- [x] `Trait` has `mode?: 'alwaysOn' | 'hidden'`, and absent means Optional (Q17). This ticket implements `alwaysOn`. This is a world export shape change.
- [x] Settle treats every Always On trait whose gate holds as proposed. When its gate fails, it leaves like a cascade-off trait and returns through the same path.
- [x] The gate module refuses to switch an Always On trait in either direction. It also refuses a max-1 swap that would retire an Always On sibling.
- [x] Default selection includes active Always On traits and counts them toward the max. `isDefault` and `playerToggle` are ignored for a non-Optional mode.
- [x] The trait editor has a mode control, Optional / Always On (Q18). Always On hides the Default and Player Can Toggle fields.
- [x] The setup list and the Traits tab hide a dormant Always On trait. They show an active one checked with no control.
- [x] Test Bench rule `trait-group-always-on-over-max` (warning): Always On traits that can be active together exceed the group's max, per bearer.
- [x] The same behavior holds for entity-owned traits (Q11).
- [x] Tests: the curse chain on and off, with its return; switch refusals; the counts toward min and max; the max-1 refusal; dormant and active rendering; the new rule. Each guard is shown to bite.
- [x] The changelog line is in In Progress. The response carries the export-shape reminder.

## Comments

- The Test Bench rule ships Q32's option C: a backtracking search over each group's Always On traits, largest set first. A set counts when one selection opens every gate, chains followed to their roots, with no two max-one rivals picked. Past 20,000 search steps per group it falls back to option A and reports every unlockable Always On trait. It runs once per persona choice and reports the largest set any of them opens.
- An Always On trait never joins the cascade-off list. Settle proposes it every time, so its mode alone brings it back. A lifted curse still reports in `turnedOff`, so the banner and the log name it.
- `exclusiveSiblings` leaves Always On traits out both ways (Q29). So a requirement on an Always On trait can hold through its max-one sibling, and the stat-toggle conflict note counts that sibling.
- In play, settle acquires an Always On world trait the player lacks as it turns on. The log reads "Trait switched on".
- Preview-only default readers (Test Bench lens, authored-scene chips, bearer preview) use `defaultPicks`, which counts only ungated Always On traits, since they check no gates.
- `settleDefaults` reruns the cap with the Always On traits a default opens counted, so such a trait takes its group's room ahead of an Optional default (review fold-in).
- Named, not fixed:
  - An Enter World category whose traits are all dormant Always On still shows its page with no rows. Hiding it would move the category index as picks change. With a minimum that only those traits can meet, Begin stays disabled with nothing to pick; `trait-group-defaults-below-min` reports that world.
  - Nothing settles on save load. A world edit that adds an ungated Always On trait, or turns a switched-off Optional trait into Always On, takes effect at the next switch or persona change.
  - Stat code can switch on an Optional sibling beside an active Always On trait in a max-one group, since code ignores pick counts (ticket 01).
  - `alwaysOnOverMax` ignores Optional groups' maximums when it picks what opens a gate, so it can over-report.
