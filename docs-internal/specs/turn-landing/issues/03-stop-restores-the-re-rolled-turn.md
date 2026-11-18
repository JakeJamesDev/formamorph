# 03: Stop Restores The Re-Rolled Turn

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A player who presses Stop during a stat re-roll gets the turn back exactly as it was before the re-roll (Q9).

Read from source, not reproduced: when no before-box script wrote, the stopped re-roll restores nothing, so entity stats, traits and items stay at pre-turn while player stats stay post-turn. The Stop can also place a page snapshot of that mid-re-roll state, and the turn's bar deltas stay cleared.

- Start with a mounted test that reproduces each part. If a part does not reproduce, record what the runtime state showed and close that part as a finding.
- A stopped or failed re-roll restores the whole turn: player stats, entity stats, traits, pins, lore, media, items, tells and the bar deltas.
- The page snapshot after a stopped re-roll holds the turn as it was.
- The restore stays in the game view (Q19). It restores from one captured state, so a field added later cannot be missed; ticket 09 extends that state with memory.

## Acceptance criteria

- [ ] A mounted test stops a stat re-roll in a world with no before-box script and finds every part of the turn as it was before the re-roll. It fails on the code before this ticket, or the Landed section says it did not reproduce and shows the state read.
- [ ] The same test in a world whose before-box script writes still passes.
- [ ] The stat bars show the turn's deltas again after the Stop.
- [ ] Paging back and forward after the Stop shows the turn as it was.
- [ ] A re-roll that completes is unchanged: the parity test from 02 still passes untouched.
- [ ] Changelog fragment written, under Fixed.
- [ ] World and save `.json` shape unchanged.

For you: start a stat re-roll and press Stop while the stat request runs; check the bars, traits and items match the turn before the re-roll.
