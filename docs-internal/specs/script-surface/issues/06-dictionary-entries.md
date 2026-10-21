# 06: Dictionary Entries

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one new map on an existing entry, following the pattern the entity maps already use.

## What to build

Each `dictionaries` entry gains `entries`, a map of the book's entries by entry name, each with `id`, `name`, `keys` and `value` (Q27). A book the player turned off is not listed, as today. The Sandbox Snapshot carries the entries for play and the editor; hover cards and the Variable menu show the map and its fields.

Spec: Q27, story 13.

## Acceptance criteria

- [ ] `dictionaries.Lore.entries["Iron Crown"].keys` reads the entry's keywords and `value` its text; a muted book is absent
- [ ] Hover cards resolve `dictionaries.Lore.entries` and an entry's four fields; the Variable menu lists them under the book
- [ ] An entry name with a space reads through brackets, as the other maps do
- [ ] Four gates green

## Blocked by

- None (can start immediately)
