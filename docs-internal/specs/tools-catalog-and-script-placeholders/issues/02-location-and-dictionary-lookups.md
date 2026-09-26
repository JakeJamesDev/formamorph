# 02: Location and Dictionary Lookup Tools

Status: ready-for-human
Base: bdb99575
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: two catalog entries over the existing lookup handler plus one matching change; the `get_entity` catalog and runner tests are prior art.

## What to build

A player finds `get_location` and `get_dictionary_entry` in every preset's Tool list beside `get_entity`, switched off. Each opens locked in the editor, follows the global Tools switch and the per-preset switch, exports as a switch only, and works in Try It. `get_location` matches a location name in any case and returns the full description. `get_dictionary_entry` matches an entry by its name or by any trigger keyword, in any case. The dictionary source's name match applies to user lookup Tools too. Each description follows the `get_entity` outline and defaults Offered To narration.

## Acceptance criteria

- [x] Both Tools listed on every preset, default off, definition locked, Offered To and call limit editable
- [x] A preset export carries only the switch; import restores it
- [x] Location lookup: hit, case-insensitive hit, miss returns `{"matches": []}`, full description returned
- [x] Dictionary lookup: keyword hit, name hit, case-insensitive hit, miss returns the empty result
- [x] Try It works on both with and without a world open
- [x] Runner, catalog, and offer tests cover the above; each fails when its behavior is removed
- [x] Four gates green, `graphify update .` run, In-Progress changelog entry added

## Notes

- Commits: b981d70a, ac0e0669, 7ebd0e06. The dictionary hint "Matches dictionary names and trigger keywords, in any case" ships with ticket 01, by agreement between the two sessions.
- Probe numbers for both descriptions belong to ticket 07. Both Tools stay off by default.
