# 10: Scripted Choices Reach Later Scripts In A Re-Roll

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

In a stat re-roll, the scripts that run late in the turn read the choices the After the AI scripts set, as they do in the live turn (Q16).

Today the live turn hands a script's replaced choices to the settle and item scripts. The stat re-roll does not, so those scripts read the AI's own list.

- Both modes hand the scripted choices on at the same step of the Turn Landing.
- Remove this named mode difference from the module.

## Acceptance criteria

- [ ] An interface test lands a commit in both modes where an After the AI script replaces the choices; the settle and item-event steps read the scripted list in both. It fails on the code before this ticket.
- [ ] With choices off, neither mode hands a list on.
- [ ] The parity test from 02 no longer lists this difference.
- [ ] Changelog fragment written, under Fixed.
- [ ] World and save `.json` shape unchanged.

For you: none.
