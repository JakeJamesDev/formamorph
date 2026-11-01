# 22: A Name of Only Spaces Is Blank

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one shared check, read by entities and dictionary entries.

## What to build

A dictionary entry or entity whose name holds only spaces counts as named, so a script reaches it under that key. Ruling Q18: a name that holds only spaces is blank, for both. The shared name-key check changes, so the script map, the write-back, the analysis and the code cards all follow.

Spec: Q18. Evidence: ticket 15, Landed.

## Acceptance criteria

- [ ] A test with a space-only entry and a space-only entity fails today (each gets a key), then passes with neither key
- [ ] A name with spaces and text keeps its exact key, spaces included (test)
- [ ] Scripts-Reference's rule on unnamed entries and entities covers it; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤
