# 04: Inventory Owners by Alias

Status: done
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

- [x] An op owned by an entity's Alias, built from a placeholder, applies to that entity. (`pass.owners.test.ts`: "applies an op owned by an Alias built from a placeholder", alias resolved through `resolveEntityNames`.)
- [x] A transfer whose `to` is an Alias applies. ("applies a transfer whose `to` is an Alias, and a gain to one".)
- [x] An op owned by a stranger's Stranger Name applies to that stranger, and so does one owned by its latest story alias, met or not (Q19). ("applies an op owned by a stranger's Stranger Name…"; dropping the Stranger Name from `passOwners` turns it red.)
- [x] An op owned by a name no present owner carries is still skipped with today's reason. ("still skips a name no present owner carries".)
- [x] Reinstating the Name-only owner list makes the Alias test fail. (Mutated `passOwners` to return Name-only owners: 4 of 6 tests red. Moving Aliases into the exact-Name step reddens the Name-precedence test.)

## Landed

The owner list on the turn stays `{ id, name }` (no save change). `inventoryPassOver` rebuilds Aliases and stranger names live from the ids, so a stat re-roll matches by Alias too. The printed `<INVENTORY>` chip is unchanged, so no probe ran.

Change from the ticket text (Q19): the pass accepts the Stranger Name and the recorded story alias met or not, with no met check. Review found an unmet-only rule lost both names on a re-roll after the turn met the stranger. A Name still wins, and a name two owners share matches no one. The turn's own cast aliases reach its pass through `strangerAliasesRef`, ahead of the render.

**Not verified**

- The GameViewer wiring (`passOwners(owners, allEntities, strangerAliasesRef.current)` in `inventoryPassOver`, and the ref write beside `setStrangerAliases`) has no test of its own. It sits inside the god component; checked by reading the turn, re-roll and choice-rerun call sites.

**For you**

- Play a world where an entity's Name is a title and its first name is an Alias. Have the story give it an item, then check its Inventory tab.
