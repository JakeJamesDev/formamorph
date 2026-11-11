# 03: Play Reads Position

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

In a running game, every part that asks "who is here" or "where is this entity" asks the Entity Places module for Position. Today these readers get a copy of the cast whose `locations` field was overwritten with where each entity stands. That copy stops being how they read.

Readers that move: the turn's "who is here" computation, the met roster by location, the narration's visitor additions, the reachable runtime visitors, the sub-location and reachable entity lists that feed the Entities chip, the live chip scene, the game view's present ids, scene entity override and inventory owners, the new-game opening draw, and the play fields of the script snapshot.

Corrections that land here (Q9, Q10):

- **No Position means nowhere.** An entity with a kind and no Position today falls back to the stored list and stands at every routine place at once. It stands nowhere.
- **The page-one opening redraw (#9).** It reads live Positions against the opening's start location, so its pool changes after entities move. It uses the placement the game opened with.

The script snapshot's fallback for an entity with no position goes with the first correction. A script run that has no live positions at all belongs to ticket 05.

Add each moved reader to the agreement test.

The changelog fragment names the two corrections as fixes.

Spec rulings: Q6, Q9 (#9), Q10.

## Acceptance criteria

- [ ] Each reader listed above gets its cast from the module's Position answer. The landing lists each reader and its test.
- [ ] In a running game, an entity with a kind and no Position is in no location's cast, in the narration context, the Entities tab data, the live chips and the script snapshot. The test fails when the old fallback is restored.
- [ ] After an entity leaves the player's start, a redraw of page one draws from the same pool as the first draw. The test fails with the old read.
- [ ] A Unique entity with a Position is at that place only, and a Generic entity is at each place a Generic Entity Instance stands, once.
- [ ] A runtime character met this turn counts where it stands.
- [ ] An existing save loads with every entity where it was. A test loads a stored save fixture and compares who is at each location before and after.
- [ ] The agreement test holds every reader moved here.
- [ ] A changelog fragment records the two fixes.
