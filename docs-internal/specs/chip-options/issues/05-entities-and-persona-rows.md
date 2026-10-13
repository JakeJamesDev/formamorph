# 05: Entities And Persona Rows

Status: done
Blocked by: 02, 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: rows on a finished shell over ids and renderer options that already exist.

Parent: [Chip Options spec](../spec.md)

## What to build

The Entities and Persona chips show their full row set in Chip Options.

- Rows in order: Entities (scope, Entities only), **Only With** (Stats, Traits), Content, **Include** (Traits, Stats), **Stat Detail** (Range, Descriptor, Description), Format, then placement.
- Include Stats reads the scope's stats piece: on by default for Here and In Scene, off by default for Sub-Locations and Reachable (Q24).
- Name content disables Include and Stat Detail; Only With stays live (Q26). Stats off disables Stat Detail. The last Stat Detail piece on is locked.
- Tooltips on the rows follow the Writing Guide.
- Ticket 04's shell names toggle rows by polarity: an on-by-default toggle lands in Include, any other in Stat Detail. The new detail ids are off-states, so that split goes; the rows and their locks come from the registry's lock groups (Q30). Ticket 02 hides the six new axes behind a registry flag; this ticket removes the flag (Q39).
- The shell reads the Entities stats axis as two-state: on `reachable.stats` its Stats box shows unchecked and a click clears to the scope default, and it never writes the `stats` id. This ticket makes the Include Stats checkbox read and write all three states (Q38).
- Lock groups are names scoped to one variable (`lockGroup: 'statDetail'` on each of the three chips). Read a group within one chip's axes only.

Rulings: Q4, Q13, Q23, Q24, Q26, Q28.

## Acceptance criteria

- [ ] Each new row writes its id and reads it back on reopen.
- [ ] Name content disables Include and Stat Detail and leaves Only With live.
- [ ] Stats off disables Stat Detail; the last detail piece on cannot be cleared.
- [ ] Switching scope to Sub-Locations shows Include Stats off; turning it on writes the stats-on id.
- [ ] The chip label does not change for any of the six new ids.
