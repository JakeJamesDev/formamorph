# 01: Refusal Totals

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-telemetry/spec.md` in formamorph (Refusal totals, report `refusals`)

Model rationale: a write on every refusal, the `rate_limited` path included, plus retention and erasure promises the privacy policy makes.

## What to build

Each refused Formamorph AI call adds one to a per-day total for its account, refusal code and tier. An admin reads the totals in the usage report's new `refusals` section. Players see exactly the refusal they get today. The 30-day sweep and account erasure treat the totals as they treat usage rows.

## Acceptance criteria

- [ ] An additive schema step creates the refusal table, keyed by day, account, code and tier, with an empty-string tier when the request has none.
- [ ] Every refusal sent through the shared refuse helper is counted under its code, except `upstream_error`.
- [ ] Entitlement, pause, rate limit, bad request and allowance refusals each show up in the report under their code.
- [ ] One refused request repeated many times adds to one total and adds no rows.
- [ ] The refusal reply status and body are unchanged.
- [ ] When the refusal write throws, the same refusal still answers and the failure is logged.
- [ ] The report's `refusals` section shows per day and code the count and distinct accounts, per tier and code, and the distinct accounts refused for `budget_exhausted`.
- [ ] No part of the `refusals` section holds a spend subject or an account id.
- [ ] The usage sweep deletes totals whose first time is past `retentionDays` and keeps newer ones. Its return value holds the refusal deletions.
- [ ] Account erasure nulls the account on its totals and keeps the totals.
- [ ] CONTEXT.md has a **Refusal total** entry.
- [ ] Removing the refusal write turns at least one refusal test red.
