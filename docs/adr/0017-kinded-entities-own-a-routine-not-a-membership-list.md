# ADR-0017 — An entity with a kind owns a routine, not a membership list

**Status:** Accepted · **Date:** 2026-11-11 · **Replaces in part:** [ADR-0003](0003-entity-owned-location-membership.md)

## Context

ADR-0003 gave each entity the list of locations it belongs to. Entity kinds then added Starts, Schedules and Can Also Go, and the list became a copy derived from them. In play the same field was overwritten on copies with where the entity stands.

One field held three meanings. Each reader had to know which one it held. Ten of about twenty readers got a wrong answer, and three fixes in one week corrected readers one at a time.

## Decision

- An entity with a kind (Unique or Generic) **stores no `locations`**. Its routine is the only source of its places.
- An entity with no kind keeps the stored list as plain membership, as ADR-0003 set it.
- **One module** answers where an entity is. Readers ask one of four questions: **Position** (where it stands now), **Sample Placement** (where authoring places it at the start of the story), **Presence** (every place it can be, with the reason for each), **Start places** (where it can begin).
- No code outside that module reads an entity's `locations`. A lint rule holds this.
- "Who is at this place" stays an inverted index, now a query on the module.

## Consequences

- World and entity card files change shape. A build older than entity kinds reads an entity with a kind from a newer world as placed nowhere.
- A reader names its question, so "where it can be" and "where it is" cannot be mixed up.
- Presence has one definition. Player's Starting Location expands to the starting locations; a row place with no path from its Start is left out.
- An entity with a kind and no Position stands nowhere.
- A new reader fails lint until it asks the module.

## Alternatives rejected

**Keep the derived list stored, read only by the module**: no shape change, but the file can still contradict the routine, and a writer that forgets the rebuild stores a stale list.

**A test that readers agree, with no lint rule**: a new raw reader passes until someone adds it to the test.
