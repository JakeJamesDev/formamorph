# 02: Per-turn settle on one stat snapshot

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the ordering decision for a commit that lands stats in four queued steps while stat code already settles mid-run. The commit applier is in the god node. Highest risk of the effort.

Parent: [Image Visibility Rules spec](../spec.md)

## What to build

A stat-gated trait follows the stat in play (Q9, Q13, Q19). Rage drains below 80: Berserk cascades off and its effects reverse. Rage recovers: Berserk returns through the cascade-off list. A trait the player switched off by hand stays off.

- The commit captures one stat snapshot after AI asks, regen, the starvation penalty and `code` writes have all landed. Every settle in that commit reads it: the settles that stat-code trait switches trigger and the final per-turn settle. Trait effects apply after the read; nothing re-reads in the same commit.
- The final settle runs in the commit applier before the turn snapshot is armed.
- Re-generate and stat re-roll replay stat code and settle once after the replay against the same kind of snapshot.
- Settle on load (the existing after-render effect) gains stat values. No new step.
- Trait toggles by hand and persona switches keep their existing settle calls and read live values.
- The gate input builder in the trait runtime reads the player's stats from gameplay stats and entity stats from the values the turn already keeps.
- Until this ticket lands, in-play gate inputs carry no stats, so a stat gate that opened at setup cascades off at the first in-play settle (ticket 01 note). Closing that gap is part of this ticket's acceptance.

## Acceptance criteria

- [ ] A stat-gated trait across three commits: off, on, off. Effects reverse on cascade; the trait returns when the gate holds again.
- [ ] A hand switch-off stays off while its gate holds.
- [ ] A trait that adds to the stat its gate reads settles once per commit and never flips within a commit. A guard test proves a second settle in the same commit would flip it.
- [ ] A stat-code trait switch mid-commit and the final settle read the same snapshot. A guard test proves a live read differs.
- [ ] Re-generate, stat re-roll and save load each settle once with stat values.
- [ ] Worlds with no stat Conditions produce the same active set as before on every commit (parity test over an existing fixture).
- [ ] Changelog fragment written. Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
