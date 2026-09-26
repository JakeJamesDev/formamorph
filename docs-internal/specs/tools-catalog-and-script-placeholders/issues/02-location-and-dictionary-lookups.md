# 02: Location and Dictionary Lookup Tools

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: two catalog entries over the existing lookup handler plus one matching change; the `get_entity` catalog and runner tests are prior art.

## What to build

A player finds `get_location` and `get_dictionary_entry` in every preset's Tool list beside `get_entity`, switched off. Each opens locked in the editor, follows the global Tools switch and the per-preset switch, exports as a switch only, and works in Try It. `get_location` matches a location name in any case and returns the full description. `get_dictionary_entry` matches an entry by its name or by any trigger keyword, in any case. The dictionary source's name match applies to user lookup Tools too. Each description follows the `get_entity` outline and defaults Offered To narration.

## Acceptance criteria

- [ ] Both Tools listed on every preset, default off, definition locked, Offered To and call limit editable
- [ ] A preset export carries only the switch; import restores it
- [ ] Location lookup: hit, case-insensitive hit, miss returns `{"matches": []}`, full description returned
- [ ] Dictionary lookup: keyword hit, name hit, case-insensitive hit, miss returns the empty result
- [ ] Try It works on both with and without a world open
- [ ] Runner, catalog, and offer tests cover the above; each fails when its behavior is removed
- [ ] Four gates green, `graphify update .` run, In-Progress changelog entry added
