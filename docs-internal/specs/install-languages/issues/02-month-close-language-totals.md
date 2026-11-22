# 02: Month Close Writes Language Totals

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/install-languages/spec.md` in formamorph (Server)

Model rationale: a transactional close whose totals must match the live counts exactly.

## What to build

Month Close writes the day and month language totals to a new table before it deletes the month's rows. The admin route reads closed periods from it.

## Acceptance criteria

- [ ] A new table holds period kind, period, dimension (`device` or `ai`), language and count, with a unique index on kind, period, dimension and language.
- [ ] The close writes the language totals in the same transaction as the existing totals.
- [ ] A close that runs twice writes the language totals once.
- [ ] The admin route returns the same language splits before and after the close.
- [ ] A month closed before this ticket shows empty language splits, not an error.
