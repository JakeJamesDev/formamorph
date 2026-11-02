# 05: Other World Writes Chain

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Finishes Q4, so no kind of write is an exception.

## What to build

A later script reads an earlier script's Body, location, clock, memory, diary, discover and entity move writes. What lands stays as it is today. A During AI Output write still lands with After the AI. A stat re-roll still keeps the turn's location, time, scene entities, memories and diary lines, so its chain can read a location write that the re-roll then discards.

Ruling: Q4.

## Acceptance criteria

- [x] A test through `runStatCodeTurn` proves a later script reads each kind of write: Body, location, clock, memory, diary, discover and entity move. (`statCodeTurn.worldChain.test.ts`, "reads a … write" cases; the diary line is proved through a `diary` call on an entity an earlier script discovered, per Q30)
- [x] A test proves `clock.advance` calls still add up and count once. (`worldWrites.minutes` is 180; the later clock reads the same as a run started there, with and without an AI-measured duration)
- [x] A test proves a script stopped by an unknown location name adds nothing to the chain. ("a script that stops adds nothing to the chain")
- [ ] A test proves a stat re-roll keeps the turn's location, time, scene entities, memories and diary lines. (Partly: a replayed Tool call carries no scene write, and a re-roll's chain reads a location write. That the caller then drops it is in `GameViewer.tsx`, which no test reaches)
- [x] Each new guard fails when that kind of write stops chaining. (Blanket removal: 8 of 9 red; the stop case guards the existing Q6 rule. Clock, entity moves, memory rows and the duration rule each removed alone: only their test red)
- [x] The sections on those writes in Scripts Reference describe this where they now say "later in the same run", and the changelog entry from ticket 02 covers it. (The Order of Effects bullets, `clock.advance`, `location.move`, `meet`, `discover` and the memory verbs)

## Landed

**Rulings from the spec session (Q30 to Q33)**
- A `memories.add` line reads as the turn's own digest row, and a `memories.pin` line as a Custom row under `script:<turnId>:<n>`, so a later row verb resolves at commit. `SandboxTurn` gains an optional `id`.
- A chained discovered character takes its name as its id, so diary and move writes that name it land by name.
- `clock.advance` calls replace the turn's duration in the chain, as the commit lands them. `StatClock` gains an optional `advancedHours`.

**Not verified**
- The stat re-roll criterion: no test reaches the drop in `GameViewer.tsx`. The chain's read of a location write is tested.
- A live game. Only the affected-tests gate covers it.
- A bare `discover("Name")` adds no entity to the chain, since none exists until the discover pass describes it.
- `meet` sets `met` in the chain and leaves `inScene` as it was.

**For you**
- Play a world with a Before the AI script that moves the player and an After the AI script that reads `location.name`: it reads the new place.
- Call `clock.advance(60)` in two scripts, then read `clock.hour` in a third: it reads the later hour, and the turn lasts the two hours.
