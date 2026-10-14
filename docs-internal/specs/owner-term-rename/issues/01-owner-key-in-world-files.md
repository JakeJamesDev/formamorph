# 01: Owner Key in World Files

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: three import seams and an idempotent migration.

## What to build

The saved requirement field `bearer` becomes `owner`, with the same value shape (`you`, or an entity with id and optional name). Every reader of the field moves to `owner` in the same ticket, so the app never reads a key the file no longer writes.

- The world migration rewrites `bearer` to `owner`. A second run changes nothing.
- The entity file importer and the character card importer run the same rewrite.
- Exports write `owner` only (Q9).
- The world format doc documents `owner` and notes that `bearer` loads.
- This ticket writes the one In Progress changelog entry for the rename. Later tickets fold into it.

**Export-shape reminder:** this ticket changes the world file (Q5, Q9).

Spec: Q5, Q9, S1.

## Acceptance criteria

- [ ] An old world's `bearer` loads as `owner` with the same value
- [ ] A second migration changes nothing
- [ ] An entity file and a character card from before the rename load their owners
- [ ] A fresh export writes `owner` and no `bearer`
- [ ] Guard bites: reinstating a `bearer`-only reader fails the migration test
- [ ] World format doc updated; changelog fragment for the rename entry; four gates green

## Blocked by

- None (can start immediately)
