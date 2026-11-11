# 02: Add the Entity Places Module

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

One module that answers where an entity is. It is added beside the stored `locations` field; no reader moves in this ticket and no behavior changes.

The module answers four questions for every entity (Q2, Q6):

- **Position**: where it stands now, from the position book. A Unique entity has one. A Generic entity has one per Generic Entity Instance, and two in one place count once. An entity with a kind and no Position stands nowhere (Q10). Runtime characters are answered too.
- **Sample Placement**: where authoring places it at the start of the story, for a given player start.
- **Presence**: each place it can be, with one or more reasons: it begins there, a Schedule row names it, Can Also Go lists it. Player's Starting Location expands to the world's starting locations, or to every location when none is flagged. Can Also Go set to Anywhere is a flag on the answer, not every location. A row place with no path from its Start is left out (Q7, Q8).
- **Start places**: where it can begin, with Player's Starting Location expanded.

It also answers the inverse of each: which entities are at one place or at any of several places, in the cast's own order (ADR-0003's inverted index, kept by ADR-0017).

For an entity with no kind, all four answers come from its stored membership list. The module is the only code that needs to read that list. It also owns the write of that list for a no-kind entity.

This ticket owns every shared type and helper of the module. Tickets 03 to 09 import them and add none of their own for these questions. If a later ticket needs an answer the module lacks, it asks the spec session.

Build the agreement test here: one fixture world, and a table of readers that must match the module. Seed it with the readers that already agree today (the turn's "who is here" computation, the live chip scene, the authored chip scene). Tickets 03 to 09 each add their readers to it.

Do not design the interface from this ticket's wording. Read the readers listed in the spec's Q9 and in the tickets that follow, and give them the smallest interface that serves all of them.

Spec rulings: Q2, Q6, Q7, Q8, Q10, Q12. ADR-0017.

## Acceptance criteria

- [ ] The module answers Position, Sample Placement, Presence and Start places for a Unique entity, a Generic entity and an entity with no kind. Module tests cover each.
- [ ] Presence carries a reason per place. Tests cover: begins there, a row names it, Can Also Go lists it, and a place with two reasons.
- [ ] Player's Starting Location expands to the flagged starting locations, and to every location when none is flagged. Tests cover both, for Presence and for Start places.
- [ ] Can Also Go set to Anywhere is reported as a flag and adds no place.
- [ ] A row place with no path from its Start is absent from Presence. The test fails when the path check is removed.
- [ ] An entity with a kind and no Position stands nowhere. Two Generic Entity Instances in one place give that place once.
- [ ] A runtime character has a Position.
- [ ] The "who is at this place" queries return ids in cast order for one place and for a set of places.
- [ ] The agreement test exists, runs on one fixture world, and holds at least the three seeded readers to the module.
- [ ] No reader outside the module changes in this ticket, and no user-facing behavior changes. The landing states how that was checked.
