# Spec: Formamorph AI Telemetry

Status: ready-for-agent
Spec session: hosted-ai-telemetry — spec
Repo: FormamorphServer

Server-only. The client already sends what this needs. Real budgets, caps and prices stay in the local hosted-tier note, never in this repo.

## Problem Statement

The first days of Formamorph AI usage left three questions that the usage rows cannot answer.

- **Refusals leave no trace.** A refused call gets an HTTP reply and nothing is stored. Heavy accounts are approaching their weekly allowance, and when one hits it, staff will not see it. Staff also cannot see a rate limit, a pause, or an unconfirmed pledge turning players away.
- **Staff cannot tell whether near-cap refusals come too early.** Admission reserves the estimated prompt plus all of `max_tokens`. The prompt estimate runs about 1.5× high on every prompt type, and real output is a small part of the cap. The row keeps only the settled cost, so the size of the reservation is lost.
- **Usage cannot be tied to a build.** New prompt types appear, and some turns have no narration call. Staff cannot see which client version makes them.

## Solution

The proxy records three new things. The admin usage report shows them. The privacy policy says so.

- **Refusal totals.** Each refused Formamorph AI call adds one to a per-day total for its account and refusal code. The total also keeps the tier, the spend subject, and the first and last time of the day.
- **The reservation.** Each usage row keeps the capped `max_tokens` and the reservation it was admitted on.
- **The client version.** Each usage row keeps the calling build's version from the client header the app already sends.

The admin usage report gains sections for each one. The privacy policy lists the new fields.

The abort cause is already recorded and is not part of this spec. The status `aborted` is set only when the client closes the connection. The idle limit settles as `error` with failure `idle_limit`.

## User Stories

1. As an admin, I want each refused Formamorph AI call counted, so that I know players are being turned away.
2. As an admin, I want refusals split by refusal code, so that I can tell a spent allowance from a rate limit, a pause or an entitlement problem.
3. As an admin, I want refusals counted per UTC day, so that I can see a trend over the report's range.
4. As an admin, I want the number of distinct accounts refused per code, so that one looping client does not read as a crowd.
5. As an admin, I want refusals split by tier, so that I can see which tier runs out first.
6. As an admin, I want the number of accounts refused for `budget_exhausted` in the range, so that I can judge whether the allowances fit how people play.
7. As an admin, I want each refusal total to keep the first and last time of its day, so that I can tell one bad minute from a whole evening of refusals.
8. As an admin, I want refusals that happen before an account has a spend subject still counted, so that `not_entitled` and `age_gate_required` are visible.
9. As an admin, I want a refused request that loops to add to a total and not to a new row each time, so that a misbehaving client cannot grow the database.
10. As an admin, I want refusal totals deleted after the same retention as usage rows, so that the policy's retention promise holds.
11. As an admin, I want an erased account detached from its refusal totals, so that erasure works the same as it does for usage rows.
12. As an admin, I want each usage row to keep the capped `max_tokens` it was admitted with, so that I can see how much of the reservation was output headroom.
13. As an admin, I want each usage row to keep its reservation, so that I can compare what admission held against what the call cost.
14. As an admin, I want the report to show reservation against settled cost per prompt type, so that I can see where the estimate runs high.
15. As an admin, I want the report to show reservation against settled cost overall, so that I can decide whether to tune the token ratio or the output cap.
16. As an admin, I want each usage row to keep the client version, so that I can tie a prompt type or turn shape to a build.
17. As an admin, I want rows from a request with no valid client header to store no version, so that a missing header never looks like a real build.
18. As an admin, I want the report to show calls, turns and cost per client version, so that I can see how fast players move to a new release.
19. As an admin, I want the report to show, per client version, how many turns had no narration call, so that I can find the build that makes them.
20. As an admin, I want the report never to show a spend subject or an account id in the new sections, so that the report stays as private as it is today.
21. As a player, I want the privacy policy to list every field recorded about my calls, so that I know what is kept.
22. As a player, I want the policy to say that refused calls are recorded with their reason, so that nothing is recorded that the policy does not name.
23. As a player, I want the new records to keep no text from my play, so that the policy's promise about my play still holds.
24. As a player, I want refused calls to answer exactly as they do today, so that recording them changes nothing I see.
25. As an admin, I want a failed refusal write never to change the refusal reply, so that telemetry cannot break the proxy.
26. As an admin, I want the new usage fields to be additive, so that a rollback needs no restore.

## Implementation Decisions

**Refusal totals**

- A new table holds one row per UTC day, account, refusal code and tier. Its columns: day, account id (nullable after erasure), spend subject (nullable), tier (nullable), code, count, first time, last time. An integer id is the primary key. A unique index on day, account id, code and tier makes each refusal an upsert that adds one and moves the last time. The subject keeps its latest value. SQLite treats NULLs as distinct in a unique index, so an entitlement refusal (no tier) stores an empty-string tier in the key, never NULL.
- The shared refuse helper is the one recording point. It covers the entitlement checks, the pause, the rate limits, a bad request and every admission refusal, so a new refusal code is recorded with no extra work.
- `upstream_error` is not recorded. It is a provider failure, not a refusal of the player, and the usage row already holds it as `error`. The mid-stream error event and the 500 path of the route error handler are not recorded either.
- A 401 from the auth check and a 426 from the client-version minimum never reach the helper and are not recorded. The 426 shows in the request log.
- A missing configuration also answers `service_paused`. The totals cannot tell it from a pause. That is accepted, since a missing configuration is a deploy fault the boot check shows.
- The subject and tier are stored when the request has them. An entitlement refusal has neither. Every refusal has an account, because the auth check runs first.
- The write is wrapped so that a failure is logged and the refusal still answers unchanged.
- The `rate_limited` path must stay cheap. One upsert is the whole cost.
- The existing usage sweep deletes refusal totals whose first time is older than `retentionDays`. Deleting on the first time means no stored time is ever older than the policy allows. The sweep's return value gains `refusalsDeleted`, under the same `retentionDays` gate.
- Account erasure nulls the account id on refusal totals, as it does on usage rows.
- CONTEXT.md gains a **Refusal total** entry.

**Usage row fields**

- An additive schema step adds three nullable columns to the usage table: capped `max_tokens`, reservation in micro-dollars and client version.
- The capped `max_tokens` and the reservation are the values admission already computes. They are written when the row opens, and settling never changes them.
- The client version comes from the request's parsed client header. The parser answers version zero (`0.0.0`) for a missing or unreadable header. Version zero stores null, so it never reads as a real build.
- The usage model's open and settle shapes gain these fields. The admitted call carries the capped `max_tokens` and the client version, so a retry row gets them too. A retry stores its own reservation.

**Admin usage report**

The existing report route gains three sections over the same range:

- `refusals`: per day and code, the total count and the distinct accounts. Also per tier and code, and the number of distinct accounts refused for `budget_exhausted` in the range. Distinct accounts count by account id. Erased totals add to the counts but not to the distinct accounts. Shape: `refusals: { days: [{ day, code, count, accounts }], tiers: [{ tier, code, count, accounts }], budgetExhaustedAccounts }`. Rows are sparse, only days and tiers with refusals, sorted by day or tier, then code. The stored empty-string tier reports as null. The day is the UTC day of the refusal, and the range keeps `day >= since`.
- `reservations`: per prompt type and overall, the summed reservation, the summed settled cost and their ratio. Only rows with status `ok`, cost source `upstream`, `stopped = 0` and a reservation count. Swept rows and estimated costs would force the ratio toward 1.
- The `reservations` ratio is cost / reservation, so below 1 means the estimate runs high. It is null when the reservation sum is 0. Its calls are the filtered rows, retries included.
- `clients`: per client version, calls, turns, cost and closed turns with no narration call. Calls are every row in range. A turn is judged on all its rows, not only the in-range ones, and counts once, under the version of its first row, when that first row is in range. A closed turn has no `open` row. Rows with no version count under a null version. The version is stored as the header sent it, prerelease suffix included, with no normalizing.
- Calls count every row, retries included, as the existing report sections do.

No new section returns a subject or an account id. That follows how `heaviest` drops `subject` today.

**Privacy policy**

- The Formamorph AI section's list of recorded fields adds the app version.
- It adds that each refused call is counted per day with its reason, your account, your Patreon user id or staff grant, your tier, and the first and last time that day.
- The retention line and the erasure line cover the refusal totals. The Patreon user id stays on them until the 30 days end, as on usage rows.
- The policy publishes through the existing publish step. Deploy the policy with or before the first build that records the new fields.

## Testing Decisions

- **One seam.** Tests drive the real app over HTTP. They send chat completions through the Formamorph AI route against the per-file fake upstream, then read the admin usage report. Retention and erasure are tested through their existing entry points, the usage sweep with an explicit `now` and account erasure.
- A good test asserts what the report returns for a call the test made. Two cases cannot show in the report and use the mechanisms the hosted AI tests already use:
  - **Erasure** reads the refusal table directly, because the report never returns an account id.
  - **Retention** makes refusals at different days with fake system time around the HTTP call.
- **Refusals.** Each refusal family shows up under its code: entitlement, pause, rate limit, bad request and allowance. `upstream_error` does not show up. A refused request repeated many times adds to one total and does not add rows. The refusal reply body and status are unchanged. A refusal whose write fails still answers the same refusal. The test makes the refusal model's write throw with a spy.
- **Reservation.** A call's reservation in the report matches the worst case of its estimated prompt and capped `max_tokens`. The settled cost stays apart from it.
- **Client version.** A call with a valid client header reports under that version. A call without one, or with an unreadable one, reports under null and never under `0.0.0`. A turn with no narration call is counted for its version.
- **Retention and erasure.** The sweep removes refusal totals past retention and keeps newer ones. Erasure detaches the account and keeps the totals.
- **Privacy.** No new report section contains a subject or an account id.
- Prior art: the proxy tests for refusals and streaming, the usage report tests for report sections, and the metering tests for reservations. The suite already has the fake upstream and the admin auth helpers these need.
- Per the test bar: prove each guard fails when its bug returns. For example, remove the refusal write and a refusal test must go red.

## Out of Scope

- **The serving provider.** One cluster of first-token stalls hit every prompt type at the same maximum, and staff could not tell who served those calls. The upstream does not say. Checked on 2026-11-07: a live `npm run live:hosted-ai` run in `stream` and `whole` modes shows no provider in the reply body (top-level keys `id`, `object`, `created`, `model`, `choices`, `usage`, `service_tier`, `system_fingerprint`, `x_nanogpt_pricing`; `model` names the model). NanoGPT's provider-selection page says chat responses do not expose the upstream provider. So the usage row has no provider column and the report has no `providers` section. Ask the upstream for a provider field before revisiting this.
- **A client header that names what started a turn**, such as a choice reroll or a resume. The app version narrows the turns with no narration call to a build, not a flow. That needs a client change and is a separate decision.
- **The abort cause.** It is already recorded, as the Solution says.
- **Return rate and behavior after the cap.** These are queries over existing data plus the refusal totals. They need no new recording.
- **Tuning the token ratio or the output cap.** This spec gives the data. Changing settings is a later decision.
- **A dashboard or client UI.** The admin report JSON is the only consumer.

## Further Notes

- The reservation shows how much headroom each call holds. Admission compares the week's spend, open reservations included, so an early refusal comes from other calls' open reservations, not from the new call's own.
- **Re-acceptance is the user's call.** Publishing the edited policy can require players to accept it again or not. Batch all policy text in this spec into one publish so that players see at most one re-accept.
- The schema step is additive. The deploy skill's backup rule still applies because the step touches `src/schema/`.
- Today's evidence: real/estimate is between 0.63 and 0.79 on all 20 prompt types, and the cache serves about 40% of prompt tokens. The reservation section should make the first number exact.
