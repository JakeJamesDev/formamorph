# 01: Refusal Totals

Status: ready-for-human
Base: f66b143
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-telemetry/spec.md` in formamorph (Refusal totals, report `refusals`)

Model rationale: a write on every refusal, the `rate_limited` path included, plus retention and erasure promises the privacy policy makes.

## What to build

Each refused Formamorph AI call adds one to a per-day total for its account, refusal code and tier. An admin reads the totals in the usage report's new `refusals` section. Players see exactly the refusal they get today. The 30-day sweep and account erasure treat the totals as they treat usage rows.

## Acceptance criteria

- [x] An additive schema step creates the refusal table, keyed by day, account, code and tier, with an empty-string tier when the request has none. (`hostedRefusals` step test; "stores an entitlement refusal with no subject and an empty tier")
- [x] Every refusal sent through the shared refuse helper is counted under its code, except `upstream_error`. ("does not count upstream_error"; mutation that counts it went red)
- [x] Entitlement, pause, rate limit, bad request and allowance refusals each show up in the report under their code. ("counts each refusal family under its code", parse-error path included)
- [x] One refused request repeated many times adds to one total and adds no rows. ("adds a repeated refusal to one total": 21 refusals, one row)
- [x] The refusal reply status and body are unchanged. (`expectRefusal` checks status and exact body for every family)
- [x] When the refusal write throws, the same refusal still answers and the failure is logged. ("still answers the same refusal when the write throws": entitlement and rate-limit paths)
- [x] The report's `refusals` section shows per day and code the count and distinct accounts, per tier and code, and the distinct accounts refused for `budget_exhausted`. ("sums per tier and code…", "splits by UTC day…")
- [x] No part of the `refusals` section holds a spend subject or an account id. ("never names an account or a spend subject")
- [x] The usage sweep deletes totals whose first time is past `retentionDays` and keeps newer ones. Its return value holds the refusal deletions. ("sweeps totals whose first time is past retention", "judges a total by its first time"; a `last_at` mutation went red)
- [x] Account erasure nulls the account on its totals and keeps the totals. ("nulls the account on an erased account's totals"; removing `forgetUser` went red)
- [x] CONTEXT.md has a **Refusal total** entry. (read in the diff)
- [x] Removing the refusal write turns at least one refusal test red. (mutation: 10 of 12 refusal tests red)

## Landed

**Not verified:** none.

**For you:**

- Deploy: the `hostedRefusals` schema step touches `src/schema/`, so the deploy backup rule applies.
- After deploy, read `GET /api/hosted-ai/admin/usage-report` and check that `refusals` matches what players report.
