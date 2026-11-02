# 05: Other World Writes Chain

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Finishes Q4, so no kind of write is an exception.

## What to build

A later script reads an earlier script's Body, location, clock, memory, diary, discover and entity move writes. What lands stays as it is today. A During AI Output write still lands with After the AI. A stat re-roll still keeps the turn's location, time, scene entities, memories and diary lines, so its chain can read a location write that the re-roll then discards.

Ruling: Q4.

## Acceptance criteria

- [ ] A test through `runStatCodeTurn` proves a later script reads each kind of write: Body, location, clock, memory, diary, discover and entity move.
- [ ] A test proves `clock.advance` calls still add up and count once.
- [ ] A test proves a script stopped by an unknown location name adds nothing to the chain.
- [ ] A test proves a stat re-roll keeps the turn's location, time, scene entities, memories and diary lines.
- [ ] Each new guard fails when that kind of write stops chaining.
- [ ] The sections on those writes in Scripts Reference describe this where they now say "later in the same run", and the changelog entry from ticket 02 covers it.
