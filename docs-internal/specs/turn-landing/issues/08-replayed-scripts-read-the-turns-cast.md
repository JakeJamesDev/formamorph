# 08: Replayed Scripts Read The Turn's Cast And Location

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A script that checks who is present, or where the player is, takes the same branch in a stat re-roll as it took in the turn (Q13).

Today the live turn gives each timing its own view: the before box reads the location the turn started at, and the After the AI batch and item scripts read the cast as placed for the Inventory pass. In a stat re-roll neither is set, so replayed scripts read the end-of-turn cast and the location after the turn's move.

- The replayed before box reads the turn-start location. The replayed After the AI batch and item scripts read the cast and the minute the live turn gave them.
- **Save shape (Q20).** Use what the pre-turn snapshot and the stored turn already hold wherever that gives the live turn's view. Add a saved-turn field only for what cannot be derived. Before adding one, send the spec session its name, shape, size on a busy world and the reason it cannot be derived, and wait for the user's ruling.
- A turn saved without any new field re-rolls as it does today for that part.
- Remove this named mode difference from the module.

## Acceptance criteria

- [ ] An interface test lands a commit in both modes on a turn that moved the player; the before box reads the turn-start location in both. It fails on the code before this ticket.
- [ ] An interface test lands a commit in both modes on a turn where a character joined or left; the After the AI batch reads the same cast and minute in both. It fails on the code before this ticket.
- [ ] Item scripts from the Inventory pass read the same cast in both modes.
- [ ] The parity test from 02 no longer lists this difference.
- [ ] Any saved-turn field was ruled on by the user first; the Landed section states the field, or states that none was needed.
- [ ] Changelog fragment written, under Fixed.

For you: in a world with a script that branches on who is present, play a turn where a character leaves with the player's move, re-roll the stats, and check the script's result matches the turn.
