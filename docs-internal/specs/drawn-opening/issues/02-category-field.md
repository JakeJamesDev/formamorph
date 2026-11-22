# 02: Category Field

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Every script-facing entry reads a read-only `category` string that names what it is (Q8, Q14): entity (persona included, Q15), location, item, itemInstance, stat, trait, currency, dictionary, dictionaryEntry, memory. Values follow the script-value casing convention. Previous-turn snapshots carry it too. The code surface, completions and quick reference list it on each shape.

The value "opening" is reserved for ticket 04, which adds it to the `opening` global.

Ships its own docs: the scripting wiki's entry-field tables and a changelog fragment.

## Acceptance criteria

- [ ] A script reads the right `category` on each entry shape listed above, in the stat-code turn runner.
- [ ] The persona reads "entity".
- [ ] `previous` snapshots of stats carry `category`.
- [ ] Completions and the quick reference show `category` on every shape, and code analysis treats it as read-only.
