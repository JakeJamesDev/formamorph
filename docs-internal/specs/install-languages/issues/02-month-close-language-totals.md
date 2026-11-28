# 02: Month Close Writes Language Totals

Status: ready-for-human
Base: 36cef6d
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/install-languages/spec.md` in formamorph (Server)

Model rationale: a transactional close whose totals must match the live counts exactly.

## What to build

Month Close writes the day and month language totals to a new table before it deletes the month's rows. The admin route reads closed periods from it.

## Acceptance criteria

- [x] A new table holds period kind, period, dimension (`device` or `ai`), language and count, with a unique index on kind, period, dimension and language. `active_install_language_totals`; test "refuses a second language total for one period, dimension and language".
- [x] The close writes the language totals in the same transaction as the existing totals. Test "writes the language totals in the same transaction as the other totals": a planted collision fails the last write, and no platform totals or row deletes survive. Mutation (close outside `db.transaction`) turns it red.
- [x] A close that runs twice writes the language totals once. Test "writes the totals once when it runs twice, …" asserts the language totals after a second run and after a clock-ran-back row. Mutation (language writes outside the already-closed check) turns it red.
- [x] The admin route returns the same language splits before and after the close. Test "shows the admin the same numbers before and after the close" is back to full `toEqual(before)`, languages included, on a fixture whose install changes languages mid-month.
- [x] A month closed before this ticket shows empty language splits, not an error. Test "shows empty language splits for a month closed without language totals" (200, empty splits, a stray live row ignored). Mutation (live rows feed a closed month) turns it red.

## Landed

**Not verified**

- None. Every criterion has a test, and six mutations each turned the expected test red.

**For you**

- After the deploy, the first Month Close (the next hourly sweep after 2026-12-01 00:00 UTC) writes November's language totals. Look at November's splits in the admin route on 2026-12-01: they should match what it showed on 2026-11-30.
- Months closed before this deploy show empty language splits. That is expected.
