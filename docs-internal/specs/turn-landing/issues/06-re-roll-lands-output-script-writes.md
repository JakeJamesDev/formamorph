# 06: Re-Roll Lands During AI Output Writes

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A stat, trait or pin change that a During AI Output script made in a turn is still there after a stat re-roll (Q10).

Today the re-roll resets to pre-turn and never lands those writes again. The narration is not re-rolled, so the scripts that read it do not run again.

- **Save shape (Q17, Q20).** The saved turn gains one optional field: what the turn's During AI Output run wrote, in the shape a saved On Call write uses. The live landing stores it. It is absent when the run wrote nothing. Scene writes are left out, as for On Call writes.
- The stat re-roll lands the saved writes at the same point of the order where the live mode lands the output run, with no script run.
- A turn saved without the field re-rolls as it does today.
- Remove this named mode difference from the module.

## Acceptance criteria

- [ ] An interface test lands a commit live with During AI Output writes, then lands the stored turn in re-roll mode; the same stat, trait and pin writes reach the port in both. It fails on the code before this ticket.
- [ ] The stored turn carries the field after a live landing with output writes, and omits it when the run wrote nothing.
- [ ] A stored turn without the field re-rolls with no output writes and no error.
- [ ] A save file with the new field loads; a save file without it loads.
- [ ] The parity test from 02 no longer lists this difference.
- [ ] Changelog fragment written, under Fixed.
- [ ] The Landed section states the save-shape change: field name, shape, when absent.

For you: in a world with a During AI Output script that turns a trait on, play a turn where it fires, re-roll the stats, and check the trait is still on.
