# 02: Drop root links on load and import

Status: ready-for-human
Base: 3b56bf19
Blocked by: 01

Parent: [Blueprint-Only Links spec](../spec.md)

## What to build

A link whose original sits outside Blueprints is removed at every import boundary and in `loadWorldData` (Q5). Card and library link binding treats a root match as no match.

## Acceptance criteria

- [ ] `migrateWorld` removes root links from every entity. It stays idempotent.
- [ ] Card and library link binding drops a link whose match is a root item.
- [ ] Tests: a root link dropped, a Blueprints link kept, a second pass unchanged. Each guard is shown to bite.
- [ ] The response carries the world export-shape reminder.
