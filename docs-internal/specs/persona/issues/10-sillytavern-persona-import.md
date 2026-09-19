# 10: SillyTavern Persona Import

Status: ready-for-agent
Blocked by: 01, 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Persona](../spec.md)

**What to build:** The player imports SillyTavern's persona backup file from the Entities tab, together with any number of avatar image files in one pick. Each ST persona becomes a marked library entity. The import reports what it skipped.

**Rationale for the model:** a pure converter on the pattern of the lorebook and card importers, plus a file-pick dispatch. A mid-tier model fits; high effort for the malformed-file cases.

## Acceptance criteria

- [ ] A pure converter reads the backup's three keys: the map from avatar filename to name, the map from avatar filename to description data, and the default persona key.
- [ ] An image matches a persona when its filename equals the persona's key. A matched image becomes the portrait through the existing image pipeline. An unmatched persona gets the initials placeholder.
- [ ] Each persona becomes a library entity with the mark set and a fresh id.
- [ ] In descriptions, the user macro becomes the persona's own name as plain text, and the char macro becomes "the other character". Other macros stay as written.
- [ ] ST's position, depth, role, and title fields are dropped.
- [ ] ST's default persona becomes the global default only when none is set.
- [ ] The import control of the Entities tab dispatches on file type, as the character file import does. A malformed file gives a clear error and imports nothing.
- [ ] The import shows a report of each skipped or imageless persona.
- [ ] Converter tests use a fixture backup with names from the repo's neutral set, and cover the mapping, the macro rewrites, filename matching, the missing-image path, the default rule, and a malformed file.
- [ ] The backup format is checked against SillyTavern's current source before the converter is written, not taken from this ticket.
- [ ] The import flow is checked in the preview through the dev-router.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

Interop stays one-way in. No export in ST's format. No new export-shape change.
