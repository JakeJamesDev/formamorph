# 10: Document the new routes

Status: done
Base: 2b387d53
Blocked by: 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Parent: [Stat Code Entities spec](../spec.md)

## What to build

From the effort review: authors can't find most of the new routes (story 27). The stat code guide covers only `name` and `traits` for `persona` and `entities`, and no template uses the new routes. Document every route this effort added, and add templates that use them.

## Parked work

A first pass started before 06 landed and was parked. Start from `.scratch/stat-code-entities-10.patch`: guide, templates and their test, and help topics. Its changelog line is in `.scratch/stat-code-entities-10.changelog.txt`. Apply it on top of 06 and resolve the conflicts. `.scratch/` is gitignored, so the patch exists only in this checkout.

## Acceptance criteria

- [x] The stat code guide documents `persona`, `entities` and `dictionaries` with every field: the Q9 entity fields, the Q10 trait fields, `placeholders` on each owner, and the stat `enabled` field (Q30).
- [x] The guide says what an unknown or not-in-play name reads as (Q23, Q25, Q29).
- [x] At least one built-in template reads `persona.traits`, and one reads an entity's trait or placeholder.
- [x] The editor's shared-stat-name warning states Q33: a stat that is on wins the name over a switched-off one, and otherwise the last one authored wins. Today it says only "This reads the last one authored".
- [x] Help copy follows the Writing Guide. The `copy-sweep` skill passes on the changed text.
- [x] Template tests run each new template. The changelog line is in In Progress.
