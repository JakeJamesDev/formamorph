# 01: Language Values On The Daily Send

Status: done
Base: 9601853
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/install-languages/spec.md` in formamorph (Server, Glossary)

Model rationale: a public unauthenticated write gains two client-set values, so validation decides what a script can store.

## What to build

`POST /api/active-installs` reads a JSON body `{ deviceLanguage, aiLanguage }` and stores both on the daily row. The admin route adds a `languages` split to every day and month, counted live from the rows. Month Close is ticket 02.

## Acceptance criteria

- [x] An additive schema step adds `device_language` and `ai_language` to the daily rows. Older rows read as `unknown`. Proved by "adds the two columns to an older table, whose rows read as unknown" and the step list in `bootSchema.test.js`.
- [x] A send with both languages stores them, and the admin route shows them in the day and month splits. Proved by "stores both languages and shows them in the day and month splits".
- [x] A malformed Device Language, an AI Language outside the code list plus `en` and `other`, and a missing body each store `unknown` and still count the install. Proved by "stores a Device Language that is not a language code…", "stores as unknown an AI Language that is not a listed code, en or other", "counts a send with no body, an unreadable body or a body past the limit under unknown" and "reads a body that is not an object as two unknowns".
- [x] An install that sends two languages in one day counts under the first. Its month total counts under its first row that month. Proved by "counts an install under its first languages that day, and that month".
- [x] Each language list adds up to its period's total and sorts by count, then language. Proved by "adds each list up to its total and sorts it by count, then language", for live periods. A closed period shows empty lists ("shows no language split for a closed period…") until ticket 02.
- [x] No new column holds an account id, an address or a raw Install id. Proved by "stores no account id, address or raw Install id", which now pins the six column names.
- [x] CONTEXT.md gains **Device Language**, and **Daily Send** names the two values. Read in the diff.

## Landed

Every guard was mutation-tested: 11 of 12 mutations turn the right test red. The full suite passed, 3949 tests in 56.45 s.

**Not verified**

- The language tie-break (same count, then language) cannot fail through the route. SQLite's `GROUP BY` already returns rows in language order, so removing the tie-break fails no test. The sort keeps the order fixed if the query plan changes.

**For you**

- **Deploy ticket 02 before a month with language rows closes.** Until 02 lands, Month Close deletes a month's rows and keeps no language totals, so those languages are lost. November closes on 2026-12-01. Nothing is lost while `active_installs` is off or no client sends languages.
- The test "shows the admin the same numbers before and after the close" now compares only the platform split and the live day. Ticket 02 should restore the full before-and-after equality for languages.
- The Device Language regex caps the value at 7 characters, so the spec's 12-character limit needs no check of its own.
