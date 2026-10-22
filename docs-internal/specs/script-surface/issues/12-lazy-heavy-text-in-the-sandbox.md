# 12: Lazy Heavy Text In The Sandbox

Status: done
Blocked by: 01, 03, 06, 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a host-call primitive inside the QuickJS executor, adopted by both runtimes, that must keep every read byte-identical while the prelude shrinks.

## What to build

A script run no longer pays for text it never reads. The prelude carries names, ids and the small fields of every entity, location and memory, and the book list of `dictionaries`; a book's `entries` map comes from the host on its first read (Q48). The heavy text fields, a dictionary entry's `value`, an entity's or location's `description` and `summary`, a memory's `text`, are fetched from the host on first read of that one field and then cached for the run (Q37). A read returns the same string the prelude form returned, resolved as Q30 says; a dictionary entry's `value` resolves its chips on its host read (Q54). The text gate ticket 06 added for `dictionaries` goes, since entries are cheap again. The user Tool runtime uses the same primitive over its Tool Snapshot. A run's one-second budget pauses during every host call on both engines, as it does for prompts (Q49). Nothing a script can observe changes except speed.

Spec: Q30, Q37, Q48, Q49, Q53, Q54; Implementation Decisions, "The prelude stays cheap".

## Acceptance criteria

- [x] `executeStatCode('return 1;')` over a world with 10,000 enabled entries of 1 KB runs within 3× its cost over an empty world, because the entries map is never fetched; a timing test asserts the bound and prints both numbers, plus the time of a script that reads one book's entries — `statCodeExecutor.preludeCost.test.ts`: empty world 2.9 ms, 10,000 entries 3.0 ms, reading the book's entries 138.9 ms (medians, the worlds interleaved)
- [x] Every heavy field reads the same string as before through a parity test over a fixture world: dictionary values, entity and location descriptions and summaries, memory text — `statCodeExecutor.heavyText.test.ts` "reads the string the host holds" (escapes, a lone surrogate, a NUL, 5 KB text; key order, accessors, unknown names, dropped writes), run green on base 590dc89c6 before the change
- [x] A field read twice calls the host once; a field never read calls it never — `statCodeExecutor.heavyText.test.ts` "asks the host" over a counting sandbox (`src/test/hostCalls.ts`); in a read-only run, enumerating an entry's keys reads its fields (Q53)
- [x] A user Tool script reads the same fields through the same path; its parity test covers the Tool Snapshot — `toolSnapshot.heavyText.test.ts` over a chip world and the Settings sample snapshot, entry values resolved (Q54)
- [x] The `dictionaries` text gate is removed and a computed global reads real entries — `statCodeTurn.dictionaryEntries.test.ts` "reads real entries through a computed global name"
- [ ] Four gates green — prepare runs them

## Blocked by

- 01 (Locations Map And Entity Place)
- 03 (Memories Reads)
- 06 (Dictionary Entries)
- 08 (User Tool Convergence)

## Landed

The prelude carries slot numbers in place of heavy text; one host hook answers a slot as JSON, so every string crosses intact, and the VM caches each answer for the run. A book's `entries` map is one deferred slot (Q48). Every host call pauses the budget on both engines, `console.log` and `roll()` included (Q49). No changelog entry: the slow prelude, the gate and the entries never shipped (`e9aa2621c` is not an ancestor of v3.3.3). Mutation checks: dropping the cache, the dedupe, the deferred entries, the lazy getter, the dropped-write setter, the JSON transport, either budget pause, the snapshot's resolver wiring and the prelude's resolve each turn the named tests red.

**Not verified**

- Four gates green: the review gates (typecheck, changed-file lint) pass; prepare runs all four before it lands.

**For you**

- World Editor › any Script › Test Code on `return dictionaries.<Book>.entries.<Entry>.value;` for an entry whose Value holds a placeholder chip: the result shows the chip's value, not the `{{ph:…}}` token (Q54).
- Otherwise only speed changes: a script over a world with a big dictionary runs as fast as over a small one.
