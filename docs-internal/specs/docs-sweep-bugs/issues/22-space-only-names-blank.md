# 22: A Name of Only Spaces Is Blank

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one shared check, read by entities and dictionary entries.

## What to build

A dictionary entry or entity whose name holds only spaces counts as named, so a script reaches it under that key. Ruling Q18: a name that holds only spaces is blank, for both. The shared name-key check changes, so the script map, the write-back, the analysis and the code cards all follow.

Spec: Q18. Evidence: ticket 15, Landed.

## Acceptance criteria

- [x] A test with a space-only entry and a space-only entity fails today (each gets a key), then passes with neither key (`namedEntries` and `hasEntityKey` tests; the old `!== ''` gave `'   '` a key)
- [x] A name with spaces and text keeps its exact key, spaces included (`' Old King '` in the `namedEntries` test, `' Mira '` in the `hasEntityKey` test)
- [x] Scripts-Reference's rule on unnamed entries and entities covers it; the docs tests are green (entry and entity lines edited; affected-tests gate green)
- [x] A changelog fragment under Minor / Fixed / 👤 (`docs-internal/changelog.d/docs-sweep-bugs-22.md`)

## Landed

**Not verified**
- None. The tests did not run against a reinstated `!== ''` by hand; the old check plainly keys `'   '`.

**For you**
- Locations follow the same rule (spec session confirmed): a space-only place name now gets no script key. Scripts-Reference says so on the entity list line.
- A blank-name check uses `trim()`, so tabs and newlines count as blank too.
