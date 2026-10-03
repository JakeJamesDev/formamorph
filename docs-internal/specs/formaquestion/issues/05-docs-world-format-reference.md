# 05: World format reference rewrite

Status: done
Base: 618cf31e
Blocked by: 01 — Docs checks and surface map
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An author who edits a world file by hand can trust the world format page. Every field on the page exists in the current world types, and every exported field is on the page (Q19).

Write the page from the world types and the migration net, not from the old page. Audit leads on what is wrong today:

- Stats: the page lists types `number` and `list`. The real types are `number` and `percentage`. The "Stat list items" section describes a removed feature.
- Stats: `beforeCode`, `enabled` and `hidden` are missing.
- Traits: `requires`, modes, pick counts and Blueprint links are missing.
- Entities: only a Boolean `persona`. Persona-only, Custom Persona, starting location, placeholders, entity-owned traits and links are missing.
- Top level: placeholders, placeholder groups and entity groups are missing.
- Locations: openings and pins are missing.
- The page names a **Begin** button that does not exist.

This ticket changes docs only. It does not change the export shape. If a field's meaning is unclear from the types, read the code that writes and reads it; do not guess.

Add short "How to…" sections for the hand-edit tasks a world author does: add a stat, add a trait, add an entity.

Recommended model rationale: the page must be exact against a large type file, and a wrong field name breaks a hand-edited world.

## Acceptance criteria

- [x] Every field in the exported world shape is on the page with its type and meaning
- [x] The page names no field, value or control that does not exist
- [x] The stat code guide's `beforeCode` reference resolves to a section on this page
- [x] The save file format is either covered or stated as not covered, in one line
- [x] A field-by-field check against the world types is described in the commit body
- [x] The coverage test passes
- [x] Four gates green

## Comments

**Built.** `docs/WorldFormat.md` is rewritten from `src/types/world.ts`, `migrateWorld`, `serializeWorldFile`, the Main Menu import and `storeWorld`. A scratch script read all 235 fields of the 29 world interfaces and found each on the page. Every table field on the page maps back to a type field, except `formamorphKind`, which the serializer writes. Dropping `beforeCode` or misspelling `pronouns` made the script fail in both directions. The Stat Code Guide links `WorldFormat#stats`.

**Read from code, not the types.** `value` is the Initial Value a new game starts at. `starting` seeds a stat a save lacks and the turn-one baseline. Nothing reads `statUpdates` or `StatChange.interval`. Export drops `id`, and import mints a new one. Six legacy migrations run only when `version` differs from the app's version, and the page says so.

**Gates.** Typecheck, lint, test and build pass. `src/lib/docs` passes 39/39. The full suite passes 15,598 tests.
