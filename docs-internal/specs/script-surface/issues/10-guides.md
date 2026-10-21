# 10: Guides

Status: ready-for-agent
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: documentation over a settled surface, in the guide voice, with the help vectors rebuilt.

## What to build

The Scripts guide documents `locations`, `location`, the new entity members, `memories` with its verbs and entry fields, `dictionaries` entries and `notes`, and drops `memory` and the top-level `diary`; it says a pinned digest can still lose on the band cap while a pinned line never does (R5). The Tools guide documents the converged user Tool surface and the migration, including the flagged forms and their new spellings. Both follow the writing guide. The help vectors rebuild so the help window answers from the new text.

Spec: R5, story 20; Further Notes.

## Acceptance criteria

- [ ] Every global and entry field in the spec's Surface section appears in a guide with a help line; a test or a scripted check lists the spec's paths against the guide text
- [ ] No guide page names `memory.add`, `memory.pin`, a top-level `diary(`, `world.entities` or `scene.`; the changelog is excluded from the check
- [ ] The help vectors are rebuilt and a help query about reading memories from a script finds the new section
- [ ] Four gates green

## Blocked by

- 01 (Locations Map And Entity Place)
- 02 (Diary On Entities And The Rewrite Pass)
- 03 (Memories Reads)
- 04 (Trait Switch Landing)
- 05 (Memory Verdicts)
- 06 (Dictionary Entries)
- 07 (Array Elements In Cards And Tree)
- 08 (User Tool Convergence)
- 09 (User Tool Text Migration)
