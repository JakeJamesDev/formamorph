# 05: World format reference rewrite

Status: ready-for-agent
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

- [ ] Every field in the exported world shape is on the page with its type and meaning
- [ ] The page names no field, value or control that does not exist
- [ ] The stat code guide's `beforeCode` reference resolves to a section on this page
- [ ] The save file format is either covered or stated as not covered, in one line
- [ ] A field-by-field check against the world types is described in the commit body
- [ ] The coverage test passes
- [ ] Four gates green
