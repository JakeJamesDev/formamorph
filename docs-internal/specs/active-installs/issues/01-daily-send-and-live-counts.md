# 01: Daily Send And Live Counts

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/active-installs/spec.md` in formamorph (Server, Glossary)

Model rationale: a public unauthenticated write, a keyed hash whose privacy promise the policy states, and an abuse budget.

## What to build

A copy of the app sends `POST /api/active-installs` once a day with its Install id and client headers. The server stores one hashed row per install per UTC day under the current month's key. An admin reads `GET /api/active-installs` and sees DAU per day and MAU per month, with platform and version breakdowns, counted live from the stored rows. Closing a month is ticket 02.

## Acceptance criteria

- [ ] An additive schema step creates the month-key table and the daily-row table, with a unique index on day and hash.
- [ ] A valid send counts once, and a repeated send that day still counts once.
- [ ] A send with a missing or malformed Install id, or without a readable client header, is refused and stores nothing.
- [ ] An install that sends two versions in one day counts under the first.
- [ ] The day comes from the server clock. The request has no body.
- [ ] The first send of a month makes that month's key with insert-or-ignore. Later sends reuse it.
- [ ] No stored row holds an account id, an address or a raw Install id.
- [ ] One address past its daily budget is refused. The route has its own rate-limit config.
- [ ] The admin route returns the spec's `days` and `months` shape, newest first, with `?days=N` and zero-filled days, counted live from every month that has rows.
- [ ] The admin route refuses non-admins, and no response holds a hash, a key or an Install id.
- [ ] CONTEXT.md gains **Active Install**, **Daily Send** and **Month Key**, and its **Install** and **Claim** entries match the spec.
- [ ] Dropping the unique index turns the repeated-send test red.
