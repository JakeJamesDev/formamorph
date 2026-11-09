# 04: Inventory Owners by Alias

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

A small matching change in the Inventory pass. A change to the prompt's owner list needs probe numbers, so it calls for careful judgment.

## What to build

The Inventory pass resolves an owner by any name the story uses for an entity, not only its Name (Q17).

A playtest found the bug. The entity's Name was a role title, and its in-story first name existed only as an alias built from a placeholder. The pass wrote ops owned by that first name, and every op was skipped with `nothing present is named "<first name>"`. The inventory owner list carries only each entity's id and Name, so Aliases never reach owner matching.

- Each owner on the list carries its Aliases with placeholders resolved, the same way the roster resolves them.
- Owner matching (for `owner` and for a transfer's `to`) accepts a Name or an Alias, case-insensitive, as the rest of the pass matches names. The Name wins when two owners share a word.
- For an unmet stranger, matching also accepts its label: latest story alias, else Stranger Name (Q17). An entity with only a Stranger Description has its real Name as its label (ticket 01's rule), so this case needs no extra work.
- If the owner list printed in the Inventory prompt changes, run the `probe` skill and record the numbers in the landing. If only the matching changes, no probe is needed.
- Add a changelog fragment under Fixed.

## Acceptance criteria

- [ ] An op owned by an entity's Alias, built from a placeholder, applies to that entity.
- [ ] A transfer whose `to` is an Alias applies.
- [ ] An op owned by an unmet stranger's Stranger Name applies to that stranger, and so does one owned by its latest story alias.
- [ ] An op owned by a name no present owner carries is still skipped with today's reason.
- [ ] Reinstating the Name-only owner list makes the Alias test fail.
