# 01: Presence and Runtime Positions

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The foundation: new shapes in the world and the save, and the roster that reads them. Every later ticket builds on it.

## What to build

An author opens a location's **Presence** tab and sees **Entities Here**: one row per entity at that location, with a **Movement** select and, when the entity lists other locations, a **Presence** toggle (**Everywhere Listed** / **One, at Random**). A new game places each One, at Random entity at one of its locations, and the scene rosters show it only there. A save keeps that position. A save whose position points at a deleted location falls back to the Presence rule on load.

Movement values are stored and shown, but nothing moves yet: Free and Stays Put behave the same until ticket 04.

## Acceptance criteria

- [ ] Entities gain optional `presence`, `movement` and `knownIn` fields with the spec's types. Absent means today's behavior. `migrateWorld` leaves old worlds unchanged.
- [ ] The save gains a per-entity position map beside the per-entity stat map, written only from Gameplay.
- [ ] An entity has a position when its Presence is One, or when its Movement isn't Free. A new game draws a One entity's start at random from its locations.
- [ ] The presence module gains the runtime layer: a tracked entity is at its position; an untracked one is at every listed location. Present, in-scene, sublocation and reachable rosters all read through it.
- [ ] The Presence toggle shows only with two or more locations. An entity with Everywhere Listed offers no Moves Between; switching to Everywhere Listed resets Moves Between to Free.
- [ ] The persona hides Presence and Movement, with the spec's hint.
- [ ] Load drops positions for deleted entities and re-places positions on deleted locations by the Presence rule.
- [ ] Help lines match the spec's copy table. `copy:sweep` reports 0 notices on the changed files.
- [ ] Tests at the presence-roster seam cover the runtime layer, One placement and the stale-position fallback. The parity suite stays byte-equal for a world with no new fields.
- [ ] A dev-route entry reaches the Presence tab's new section.
- [ ] Export-shape and save-shape reminders go in the landing reply.
