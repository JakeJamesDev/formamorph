# 03: Persona entities own stat traits

Status: ready-for-human
Base: 2e3227a6

Parent: [Blueprint-Only Links spec](../spec.md)

## What to build

The Custom Persona entity and Persona-marked entities may own traits with stat changes and stat toggles (Q3). They apply only while that persona is played. Other entities keep refusing them.

## Acceptance criteria

- [ ] One predicate, `canOwnStatTraits`, decides for the drop's stats refusal, Detach, the card parser and the Stats tab.
- [ ] A stat trait moves into a persona entity. It is refused on any other entity.
- [ ] Detach keeps stat effects on a persona entity and strips them elsewhere, with the confirmation only there (Q8).
- [ ] Cards read owned stat changes and toggles (Q9).
- [ ] The Stats tab shows on a persona entity's owned trait, and on any owned trait that already has stat effects, with the link stat note (Q6, Q10).
- [ ] In play, a played persona's owned stat trait moves stats and reverses on a switch.
- [ ] Tests for each rule, each shown to bite. The changelog line is in In Progress. The response carries the card export-shape reminder.
