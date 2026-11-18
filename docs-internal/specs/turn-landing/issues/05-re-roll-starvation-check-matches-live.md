# 05: Re-Roll Starvation Check Matches Live

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A stat re-roll applies the starvation penalty exactly when the turn applied it (Q11).

Today the live turn reads the threshold stats from before the before box. The stat re-roll reads them after the before box, the On Call writes and the Inventory pass, so a write or a payment that moves a stat across the threshold changes the penalty in the re-roll only.

- In both modes the Turn Landing reads the threshold from the pre-turn stats. The re-roll moves; the live turn does not change.
- Remove this named mode difference from the module.

## Acceptance criteria

- [ ] An interface test lands a commit in both modes where a before-box write moves a stat across the starvation threshold; both modes pass the same threshold stats to the stat step. It fails on the code before this ticket.
- [ ] The same holds for an On Call write and for an Inventory pass payment.
- [ ] The parity test from 02 no longer lists this difference.
- [ ] Reinstating the old read fails the new test.
- [ ] Changelog fragment written, under Fixed.
- [ ] World and save `.json` shape unchanged.

For you: none.
