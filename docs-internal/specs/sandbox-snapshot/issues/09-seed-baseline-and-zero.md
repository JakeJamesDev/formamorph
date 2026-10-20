# 09: Seed Baseline and Zero

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

The seed function ticket 07 established gains the last two parts of the opening rule, and the authored-scene chip value reads it. Ruling Q8, refined after ticket 08's review.

## What to build

A player opens a stat at its authored value with no phantom change on turn one, and an authored zero opens at zero. Behind it, the one seed function owns the whole rule. The opening value is the authored value when one is set, else the min, then clamped to the stat's range: an authored 0 with min 5 opens at 5, and an authored 0 with min −10 opens at 0. The delta baseline is written from that opening value; an authored `starting` is never read at the seed. The authored-scene Chip Scene reads the same function for the stats its opening shows.

No bundled world changes: every bundled `starting` equals its `value`, and no bundled stat sits at 0 with a nonzero min.

## Acceptance criteria

- [ ] The seed function returns the authored value when set, else the min, clamped to the range. An authored 0 stays 0 inside the range.
- [ ] The seed writes the delta baseline from the opening value. An authored `starting` is not read anywhere in the seed path.
- [ ] The authored-scene chip value reads the seed function. Its own `value`-or-min helper is gone.
- [ ] Bite tests: `starting` 10 and value 5 opens at 5 with a zero turn-one delta (fails today with −5); value 0 with min −10 opens at 0 (fails today at −10); value 0 with min 5 opens at 5; no value with min 3 opens at 3.
- [ ] The bundled worlds' opening stats are unchanged: a test seeds each bundled world's stats before and after and asserts equality, or the parity fixtures stay byte-equal and a check over the bundled worlds asserts no stat hits either edge.
- [ ] A changelog fragment with one Fixed lead for players: a stat opens at its authored value with no change shown on turn one, and an authored zero opens at zero.
- [ ] No save or world shape changes. Existing seed, trait runtime and chip value tests stay green except where this ruling changed the result, and each such change names Q8.
- [ ] Four gates green, exit codes read.
