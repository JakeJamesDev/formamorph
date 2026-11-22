# 01: Language Values On The Daily Send

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/install-languages/spec.md` in formamorph (Server, Glossary)

Model rationale: a public unauthenticated write gains two client-set values, so validation decides what a script can store.

## What to build

`POST /api/active-installs` reads a JSON body `{ deviceLanguage, aiLanguage }` and stores both on the daily row. The admin route adds a `languages` split to every day and month, counted live from the rows. Month Close is ticket 02.

## Acceptance criteria

- [ ] An additive schema step adds `device_language` and `ai_language` to the daily rows. Older rows read as `unknown`.
- [ ] A send with both languages stores them, and the admin route shows them in the day and month splits.
- [ ] A malformed Device Language, an AI Language outside the code list plus `en` and `other`, and a missing body each store `unknown` and still count the install.
- [ ] An install that sends two languages in one day counts under the first. Its month total counts under its first row that month.
- [ ] Each language list adds up to its period's total and sorts by count, then language.
- [ ] No new column holds an account id, an address or a raw Install id.
- [ ] CONTEXT.md gains **Device Language**, and **Daily Send** names the two values.
