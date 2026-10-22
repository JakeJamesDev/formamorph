# 10: Guides

Status: done
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: documentation over a settled surface, in the guide voice, with the help vectors rebuilt.

## What to build

The Scripts guide documents `locations`, `location`, the new entity members, `memories` with its verbs and entry fields, `dictionaries` entries and `notes`, and drops `memory` and the top-level `diary`; it says a pinned digest can still lose on the band cap while a pinned line never does (R5). The Tools guide documents the converged user Tool surface and the migration, including the flagged forms and their new spellings. Both follow the writing guide. The help vectors rebuild so the help window answers from the new text.

Spec: R5, story 20; Further Notes.

## Acceptance criteria

- [x] Every global and entry field in the spec's Surface section appears in a guide with a help line; a test or a scripted check lists the spec's paths against the guide text (`scriptSurfaceGuides.test.ts`, rows built from the surface lists; proved to bite by deleting the `following` row)
- [x] No guide page names `memory.add`, `memory.pin`, a top-level `diary(`, `world.entities` or `scene.`; the changelog is excluded from the check (same test; Q57 exempts the one Tools migration section)
- [x] The help vectors are rebuilt and a help query about reading memories from a script finds the new section (embedded three queries; `ScriptsGuide#memory` ranks 1st to 5th by cosine)
- [ ] Four gates green (review gates, typecheck and changed-file lint, green; prepare runs the rest)

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

## Landed

**Not verified**
- Four gates green: prepare runs the full list after landing review; only the review gates ran before it.
- The help query was checked by cosine over the shipped vectors, not in the Formaquestion window.

**For you**
- Read the new Location, Memory (band-cap note), Dictionaries › Entries sections in `docs/ScriptsGuide.md` for voice.
- Read "Moving an Old Script to the New Names" in `docs/Tools.md`: it is the one section that prints retired forms (ruling Q57).
- Ask the help window how to read memories from a script; stale vectors are rebuilt, so it should cite the Memory section.
