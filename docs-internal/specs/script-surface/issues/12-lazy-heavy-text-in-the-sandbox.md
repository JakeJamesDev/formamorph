# 12: Lazy Heavy Text In The Sandbox

Status: ready-for-agent
Blocked by: 01, 03, 06, 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a host-call primitive inside the QuickJS executor, adopted by both runtimes, that must keep every read byte-identical while the prelude shrinks.

## What to build

A script run no longer pays for text it never reads. The prelude carries names, ids and the small fields of every entry; the heavy text fields, a dictionary entry's `value`, an entity's or location's `description` and `summary`, a memory's `text`, are fetched from the host on first read of that one field and then cached for the run (Q37). A read returns the same string the prelude form returned, resolved as Q30 says. The text gate ticket 06 added for `dictionaries` goes, since entries are cheap again. The user Tool runtime uses the same primitive over its Tool Snapshot. A run's one-second budget counts host time as it does for prompts. Nothing a script can observe changes except speed.

Spec: Q30, Q37; Implementation Decisions, "The prelude stays cheap".

## Acceptance criteria

- [ ] `executeStatCode('return 1;')` over a world with 10,000 enabled entries of 1 KB runs within 3× its cost over an empty world; a timing test asserts the bound and prints both numbers
- [ ] Every heavy field reads the same string as before through a parity test over a fixture world: dictionary values, entity and location descriptions and summaries, memory text
- [ ] A field read twice calls the host once; a field never read calls it never
- [ ] A user Tool script reads the same fields through the same path; its parity test covers the Tool Snapshot
- [ ] The `dictionaries` text gate is removed and a computed global reads real entries
- [ ] Four gates green

## Blocked by

- 01 (Locations Map And Entity Place)
- 03 (Memories Reads)
- 06 (Dictionary Entries)
- 08 (User Tool Convergence)
