# 18: Shared Stat Delta Timing

Status: done
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: extracts timer-driven UI state out of the god node into one per-owner piece; leaked timers and unmount discipline are the trap.

Parent: [Entity Stats spec](../spec.md)

## What to build

Entity stat rows show a turn's change with the same timing as the player's rows: the change chip fades after 10 seconds, the band holds until the next turn, and the band drains with its animation at submit. One per-owner delta piece drives both the player's rows and entity rows, replacing the player-only state. Ruling Q57.

## Acceptance criteria

- [ ] One per-owner delta piece holds recent, held and draining changes, with their timers, for every owner.
- [ ] The player's rows behave exactly as before; their existing tests pass unchanged.
- [ ] Entity rows show the chip fade at 10 s, the held band, and the drain at submit, as the player's rows do.
- [ ] After a load, the live page shows no deltas for any owner, as today.
- [ ] Every timer is cleared on unmount and on a new game; the suite shows no leaked handles.
- [ ] Motion claims are checked with Playwright frame sampling.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
