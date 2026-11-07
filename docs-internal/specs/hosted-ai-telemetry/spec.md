# Spec: Formamorph AI Telemetry

Status: ready-for-agent
Spec session: hosted-ai-telemetry — spec
Repo: FormamorphServer

Server-only. The client already sends what this needs. Real budgets, caps and prices stay in the local hosted-tier note, never in this repo.

## Problem Statement

The first days of Formamorph AI usage left four questions that the usage rows cannot answer.

- **Refusals leave no trace.** A refused call gets an HTTP reply and nothing is stored. Heavy accounts are approaching their weekly allowance, and when one hits it, staff will not see it. Staff also cannot see a rate limit, a pause, or an unconfirmed pledge turning players away.
- **Staff cannot tell whether near-cap refusals come too early.** Admission reserves the estimated prompt plus all of `max_tokens`. The prompt estimate runs about 1.5× high on every prompt type, and real output is a small part of the cap. The row keeps only the settled cost, so the size of the reservation is lost.
- **Usage cannot be tied to a build.** New prompt types appear, and some turns have no narration call. Staff cannot see which client version makes them.
- **Slow calls cannot be tied to an upstream provider.** One cluster of first-token stalls hit every prompt type at the same maximum. The row does not say who served the call.

## Solution

The proxy records four new things. The admin usage report shows them. The privacy policy says so.

- **Refusal totals.** Each refused Formamorph AI call adds one to a per-day total for its account and refusal code. The total also keeps the tier, the spend subject, and the first and last time of the day.
- **The reservation.** Each usage row keeps the capped `max_tokens` and the reservation it was admitted on.
- **The client version.** Each usage row keeps the calling build's version from the client header the app already sends.
- **The serving provider.** Each usage row keeps the upstream provider that served the call, when the upstream reply names one.

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
20. As an admin, I want each usage row to keep the upstream provider that served it, so that I can tie a stall to a provider.
21. As an admin, I want the report to show calls, median and worst first-token time per provider, so that I can see whether one provider is slow.
22. As an admin, I want rows whose upstream reply names no provider to store none, so that the field is never guessed.
23. As an admin, I want the report never to show a spend subject or an account id in the new sections, so that the report stays as private as it is today.
24. As a player, I want the privacy policy to list every field recorded about my calls, so that I know what is kept.
25. As a player, I want the policy to say that refused calls are recorded with their reason, so that nothing is recorded that the policy does not name.
26. As a player, I want the new records to keep no text from my play, so that the policy's promise about my play still holds.
27. As a player, I want refused calls to answer exactly as they do today, so that recording them changes nothing I see.
28. As an admin, I want a failed refusal write never to change the refusal reply, so that telemetry cannot break the proxy.
29. As an admin, I want the new usage fields to be additive, so that a rollback needs no restore.

## Implementation Decisions

**Refusal totals**

- A new table holds one row per UTC day, account and refusal code. Its columns: day, account id (nullable after erasure), spend subject (nullable), tier (nullable), code, count, first time, last time. An integer id is the primary key. A unique index on day, account id and code makes each refusal an upsert that adds one and moves the last time.
- One recording point covers every refusal the Formamorph AI routes send: the entitlement checks before admission, the pause, the rate limits, a bad request and every admission refusal. The shared refuse helper is that point, so a new refusal code is recorded with no extra work.
- The subject and tier are stored when the request has them. An entitlement refusal has neither.
- The write is wrapped so that a failure is logged and the refusal still answers unchanged.
- The `rate_limited` path must stay cheap. One upsert is the whole cost.
- The existing usage sweep deletes refusal totals older than `retentionDays`, by day.
- Account erasure nulls the account id on refusal totals, as it does on usage rows.

**Usage row fields**

- An additive schema step adds four nullable columns to the usage table: capped `max_tokens`, reservation in micro-dollars, client version and upstream provider.
- The capped `max_tokens` and the reservation are the values admission already computes. They are written when the row opens, and settling never changes them.
- The client version comes from the request's parsed client header. A missing or invalid header stores null.
- The upstream provider is read from the upstream reply and written when the row settles. The first ticket step checks with `npm run live:hosted-ai` that the reply names the provider, in which field, and in both stream and whole modes. If no reply names it, that part is dropped, and the spec is updated to say so.
- The usage model's open and settle shapes gain these fields. Retries keep their own values.

**Admin usage report**

The existing report route gains four sections over the same range:

- `refusals`: per day and code, the total count and the distinct accounts. Also per tier and code, and the number of distinct accounts refused for `budget_exhausted` in the range.
- `reservations`: per prompt type and overall, the summed reservation, the summed settled cost and their ratio. Only settled rows that have a reservation count.
- `clients`: per client version, calls, turns, cost and turns with no narration call. Rows with no version count under a null version.
- `providers`: per provider, calls, median and worst first-token time. Rows with no provider count under null.

No new section returns a subject or an account id. That follows how `heaviest` drops `subject` today.

**Privacy policy**

- The Formamorph AI section's list of recorded fields adds the app version and the provider that served the call.
- It adds that a refused call is counted with its reason, per day.
- The retention line covers the refusal totals.
- The policy publishes through the existing publish step. Deploy the policy with or before the first build that records the new fields.

## Testing Decisions

- **One seam.** Tests drive the real app over HTTP. They send chat completions through the Formamorph AI route against the existing fake upstream, then read the admin usage report. Retention and erasure are tested through their existing entry points, the usage sweep and account erasure. No test reads a table or calls a model directly.
- A good test asserts what the report returns for a call the test made. It never asserts on SQL or on the row shape.
- **Refusals.** Each refusal family shows up under its code: entitlement, pause, rate limit, bad request and allowance. A refused request repeated many times adds to one total and does not add rows. The refusal reply body and status are unchanged. A refusal whose write fails still answers the same refusal.
- **Reservation.** A call's reservation in the report matches the worst case of its estimated prompt and capped `max_tokens`. The settled cost stays apart from it.
- **Client version.** A call with a valid client header reports under that version. A call without one reports under null. A turn with no narration call is counted for its version.
- **Provider.** A fake upstream reply that names a provider reports under it. One that names none reports under null.
- **Retention and erasure.** The sweep removes refusal totals past retention and keeps newer ones. Erasure detaches the account and keeps the totals.
- **Privacy.** No new report section contains a subject or an account id.
- Prior art: the proxy tests for refusals and streaming, the usage report tests for report sections, and the metering tests for reservations. The suite already has the fake upstream and the admin auth helpers these need.
- Per the test bar: prove each guard fails when its bug returns. For example, remove the refusal write and a refusal test must go red.

## Out of Scope

- **A client header that names what started a turn**, such as a choice reroll or a resume. The app version narrows the turns with no narration call to a build, not a flow. That needs a client change and is a separate decision.
- **The abort cause.** It is already recorded, as the Solution says.
- **Return rate and behavior after the cap.** These are queries over existing data plus the refusal totals. They need no new recording.
- **Tuning the token ratio or the output cap.** This spec gives the data. Changing settings is a later decision.
- **A dashboard or client UI.** The admin report JSON is the only consumer.

## Further Notes

- **Re-acceptance is the user's call.** Publishing the edited policy can require players to accept it again or not. Batch all policy text in this spec into one publish so that players see at most one re-accept.
- The schema step is additive. The deploy skill's backup rule still applies because the step touches `src/schema/`.
- Today's evidence: real/estimate is between 0.63 and 0.79 on all 20 prompt types, and the cache serves about 40% of prompt tokens. The reservation section should make the first number exact.
