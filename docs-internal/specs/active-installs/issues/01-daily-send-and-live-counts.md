# 01: Daily Send And Live Counts

Status: ready-for-human
Base: 3200aef
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/active-installs/spec.md` in formamorph (Server, Glossary)

Model rationale: a public unauthenticated write, a keyed hash whose privacy promise the policy states, and an abuse budget.

## What to build

A copy of the app sends `POST /api/active-installs` once a day with its Install id and client headers. The server stores one hashed row per install per UTC day under the current month's key. An admin reads `GET /api/active-installs` and sees DAU per day and MAU per month, with platform and version breakdowns, counted live from the stored rows. Closing a month is ticket 02.

## Acceptance criteria

- [x] An additive schema step creates the month-key table and the daily-row table, with a unique index on day and hash. (step `activeInstalls`; `bootSchema` and `smoke` tests list it)
- [x] A valid send counts once, and a repeated send that day still counts once. (`counts a send once, and a repeated send that day still once`)
- [x] A send with a missing or malformed Install id, or without a readable client header, is refused and stores nothing. (two `refuses ...` tests: 400, no row, no key)
- [x] An install that sends two versions in one day counts under the first. (`counts an install that updates during the day under its first version`)
- [x] The day comes from the server clock. The request has no body. (`takes the day from the server clock and ignores any body`)
- [x] The first send of a month makes that month's key with insert-or-ignore. Later sends reuse it. (`makes one key on the first send of a month and reuses it after`; plain INSERT turned it red)
- [x] No stored row holds an account id, an address or a raw Install id. (`stores no account id, address or raw Install id`: columns and contents)
- [x] One address past its daily budget is refused. The route has its own rate-limit config. (`gives each address a daily budget...`: 100 per 24 h, 429 on the 101st)
- [x] The admin route returns the spec's `days` and `months` shape, newest first, with `?days=N` and zero-filled days, counted live from every month that has rows. (`returns DAU per day and MAU per month...`, two months; first-row order mutation turned it red)
- [x] The admin route refuses non-admins, and no response holds a hash, a key or an Install id. (`refuses a guest...`; `never answers with a hash, a key or an Install id`)
- [x] CONTEXT.md gains **Active Install**, **Daily Send** and **Month Key**, and its **Install** and **Claim** entries match the spec. (new "Active installs" section; diff read)
- [x] Dropping the unique index turns the repeated-send test red. (ran: 2 tests red, then restored)

## Landed

Rulings from the spec session: 100 sends per address per 24 h; an unknown platform with a real version is stored as `unknown`; the `active_installs` setting, default off, answers 204 and stores nothing while off.

**Not verified**

- None. Every criterion has a test or a diff read.

**For you**

- After the privacy policy publishes, turn on `active_installs` (`PUT /api/settings/active_installs`, see `docs-internal/server.md`). Until then the server stores nothing.
- The admin response is wrapped as `{ success, data: { days, months } }`, like the funnel and usage reports.
