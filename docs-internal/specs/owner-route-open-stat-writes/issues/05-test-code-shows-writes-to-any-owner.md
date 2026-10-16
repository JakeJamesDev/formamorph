# 05: Test Code Shows Writes To Any Owner

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Seeds a dry run with every owner and lists owner-keyed writes, in the stat editor and Formaquestion. Sonnet at high effort.

## What to build

Test Code runs an owned stat's box with the world stats as `stats` and its entity as `owner`. A Blueprint stat's box gets an `owner` that holds only the Blueprint group's stats (Q10). Every owner's stats start at their starting values.

The writes list shows world writes as today and adds owner-keyed rows: owner, stat, field, number (Q8). A `persona.stats` write is listed with the pending persona writes, as persona trait writes are. Dropped writes on every route are listed with their path.

Formaquestion's code test run finds owned and Blueprint stats as well as world stats, and passes the owner the same way.

## Acceptance criteria

- [ ] Test Code on a Creature stat that writes `stats.Destruction.value` lists the write with owner, stat, field, and number
- [ ] Test Code on world code that writes `entities["X"].stats.Y.max` lists the write under that entity
- [ ] A Blueprint box's `owner.stats` holds the Blueprint group's stats only
- [ ] A `persona.stats` write is listed with the pending persona writes
- [ ] Dropped writes show on every route
- [ ] Formaquestion's code test run runs an owned stat's code with its owner
- [ ] Test Code applies nothing to the authored world
- [ ] Four gates green

## Blocked by

- 02 (Code Writes Any Stat)
