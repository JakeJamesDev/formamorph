# 07: Re-Roll Uses The Pre-Code Duration

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

When an After the AI script advanced the clock in a turn, a stat re-roll charges stat code and regen the same hours, in the same order, as the turn did (Q12).

Today the live turn runs stat code with the turn's hours from before the script's clock write, then ticks the extra hours after the code. The re-roll runs code with the final, longer hours and ticks all regen before the code.

- **Save shape (Q17, Q20).** The saved turn gains one optional number: the turn's hours before After the AI clock writes. The live landing stores it. It is absent when it equals the stored hours.
- The stat re-roll runs stat code with the pre-code hours, ticks regen for those hours before the wait, and ticks the extra hours after the code. It still never advances the clock.
- A turn saved without the field re-rolls as it does today.
- Remove this named mode difference from the module.

## Acceptance criteria

- [ ] An interface test lands a commit in both modes where an After the AI script adds clock time; both modes pass the same hours to stat code and tick regen in the same two steps. It fails on the code before this ticket.
- [ ] A script that shortens the turn is covered: no extra regen tick in either mode.
- [ ] The re-roll makes no clock-advance port call.
- [ ] The stored turn carries the field only when the script changed the turn's hours.
- [ ] A stored turn without the field re-rolls with the stored hours and no error.
- [ ] The parity test from 02 no longer lists this difference.
- [ ] Changelog fragment written, under Fixed.
- [ ] The Landed section states the save-shape change: field name, meaning, when absent.

For you: in a world whose After the AI script advances the clock, play a turn, note the stat changes from regen, re-roll the stats, and check regen matches.
