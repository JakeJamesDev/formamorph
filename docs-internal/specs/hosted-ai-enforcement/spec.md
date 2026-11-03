# Spec: Formamorph AI Enforcement

Status: ready-for-agent
Spec session: hosted-ai-enforcement — spec
Status note: Grilled 2026-11-03 (Q1–Q32). Blocks the Formamorph AI release in full (Q32). Real budgets, caps and prices stay in the local hosted-tier note, never in this repo.

An audit of the Formamorph AI proxy found that entitlement holds and the weekly allowance does not. This effort makes the allowance and the daily ceiling hold against any client, keeps entitlement honest during a Patreon outage, and fixes what the audit showed about how the client handles turn ids.

## Problem Statement

We sell Formamorph AI as a Supporter perk with a weekly allowance. The server must hold that limit against a modified client or a custom application.

Access control holds. Seventeen probes tried to get service without a paying account, and all were refused. The limits do not hold for an account that is entitled:

- **The weekly budget is checked only on a turn's first call.** A turn id stays valid for the whole turn limit, so a client can open many cheap turns while under budget, keep the ids, spend the week, and redeem every held turn at the output cap. Under test settings, one probe reached 8.2 times the budget with 8 turns and another reached 54 times with 20. The spend is real provider cost.
- **A continuation also skips the daily pause.** Held turns keep running after the pause, and their reservations can start it, so one account can pause new turns for every Supporter.
- **A pledge can stay entitled forever.** A failed Patreon reconcile changes no link, and nothing reads `checked_at`. A revoked creator token keeps lapsed members served, and nobody is told.
- **A stale webhook delivery can apply old state.** Deliveries carry no id or event time, so a repeated pledge delivery can restore a tier that has ended until the next reconcile.
- **The client never expires a turn id.** Background passes and late player actions send an expired id. The server answers `turn_expired`, the id stays in place, and every later call on that turn fails the same way.
- **Turns left can read too high.** Very cheap turns pull down the average cost per turn.

## Solution

The server applies the weekly budget and the daily pause to every call. A turn that started under budget can still finish, because each continuation gets a grace of one whole turn's maximum cost. Spend no longer grows with the number of held turns.

A pledge that Patreon has not confirmed for 7 days stops serving Formamorph AI and tells the Supporter why, in words that do not accuse them of not paying. Their flair stays. Admins hear about a failing reconcile after three failures in a row. A webhook delivery becomes a signal to re-read the member list, so the member list decides the tier.

The client expires turn ids slightly before the server does and opens a new turn for late work. The allowance surface explains that background work pauses when the week is spent.

## User Stories

1. As the owner, I want every Formamorph AI call checked against the week's spend, so that no client can spend without limit on one membership.
2. As the owner, I want the overrun on one spend subject to have a fixed bound, so that I can reason about the worst case.
3. As the owner, I want that bound to follow the configured limits and prices, so that a config change needs no second tuning step.
4. As the owner, I want held turn ids to give no extra spend, so that collecting them has no value.
5. As the owner, I want the daily ceiling to apply to started turns, so that it remains a real stop on spending.
6. As the owner, I want a first call that would reach the ceiling to be refused, so that the call that starts a pause does not also spend.
7. As an admin, I want the existing pause lift to keep working, so that I can restore service on a bad day.
8. As a Supporter, I want a turn I started under budget to finish, so that the allowance running out does not leave me with half a turn.
9. As a Supporter, I want my story to continue when a paused day cuts some passes from my turn, so that a rare service pause does not lose my narration.
10. As a Supporter, I want new turns refused when my week is spent, so that the limit is the same for everyone.
11. As a Supporter, I want the allowance surface to say that background work pauses when the week is spent, so that I know why diaries and digests stopped.
12. As a Supporter, I want background work to resume after the reset, so that the pause costs me nothing permanent.
13. As a Supporter, I want my turns-left figure to reflect real turns, so that background calls do not make it read too high.
14. As a Supporter, I want a Patreon outage shorter than 7 days to change nothing for me, so that their outage does not become mine.
15. As a Supporter, I want a clear message if my pledge cannot be confirmed, so that I am not told I have no pledge.
16. As a Supporter, I want service back as soon as Patreon can confirm my pledge again, so that I need to do nothing.
17. As a Supporter, I want to keep my flair and my place on the Supporters wall while my pledge is unconfirmed, so that I do not lose public credit to an outage.
18. As a Supporter with a staff grant, I want the grant to keep working while my pledge is unconfirmed, so that the grant means what it says.
19. As a lapsed member, I want access to end when Patreon says the pledge ended, so that the rule is the one the tier text states.
20. As an admin, I want an alert when the reconcile fails three times in a row, so that I hear about it long before Supporters lose service.
21. As an admin, I want no alert for a single failed read, so that the alert keeps its meaning.
22. As an admin, I want one alert per outage, so that a long outage does not fill my inbox.
23. As the owner, I want a repeated or late webhook delivery to be unable to restore an ended tier, so that a delivery cannot give free service.
24. As a Supporter, I want a tier change to apply as soon as Patreon's member list shows it, so that an upgrade is not delayed by a full hour.
25. As a player, I want a late scene image, diary or character note to work after a turn has expired, so that it does not fail because of an old id.
26. As a Supporter on a heavy turn, I want the turn call cap to fit a real worst-case turn, so that honest play is not cut.
27. As a developer, I want a tier value that is not a known tier to be refused before any limits are read, so that the budget does not rest on a database constraint alone.
28. As a developer, I want the audit's probes kept as regression suites, so that these gaps cannot come back unseen.

## Implementation Decisions

### Rulings

| Q | Ruling |
|---|---|
| Q1 | Bounded continuation check, not a reservation of the whole turn and not a one-call grace. |
| Q2, Q24, Q29 | A paused day refuses continuations too, with one grace call per turn. A paused day can cut post-narration passes, and that is accepted. |
| Q3, Q5, Q25 | A pledge unconfirmed for 7 days stops serving Formamorph AI. Flair and the Supporters wall do not change. |
| Q4, Q7 | Alert admins after 3 consecutive failed hourly reconciles. |
| Q6 | A new refusal code and its own client text. |
| Q8, Q23 | The red repro lands green in the same commit as its fix. The four audit probe files fold into two suites. |
| Q10 | Guard the tier before reading tier limits. |
| Q11, Q20, Q28 | No delivery dedupe, because Patreon sends no delivery id. A delivery triggers a read of the member list, and the list decides. Q28 replaces Q20's ordering guard, which cannot work. |
| Q12, Q22 | One spec with grouped tickets, each naming its repo. |
| Q13 | Grace = `turnCallCap` × the worst case of one call at window plus margin and the output cap. |
| Q14, Q17, Q18 | The client expires a turn id early, using `turnLimitSeconds` from the Hosted state. |
| Q15 | One ticket measures a worst-case turn against `turnCallCap`. |
| Q16, Q19 | The turns-left sample counts only turns with a narration call. No minimum turn charge. |
| Q21, Q31 | No webhook capture. The undocumented delivery behavior stays recorded as unknown. |
| Q26 | Background passes stop on a spent week, and the allowance surface says so. |
| Q27 | Tests use the existing seams. |
| Q30 | The spec states the mechanism plainly, because nothing it protects has shipped and Q32 lands the fix first. Production numbers still stay out. |
| Q32 | The whole effort blocks the Formamorph AI release. |

### Spend controls (FormamorphServer)

- **First calls do not change.** A first call is refused with `budget_exhausted` when the week's spend has reached the budget.
- **Continuations are checked.** A continuation is admitted only while the week's spend, minus this turn's own spend, is under the budget plus the grace. Otherwise it is refused with `budget_exhausted`.
- **Excluding the turn's own spend** keeps one turn from using up its own grace, so a turn that started under budget can finish.
- **The grace is computed per call** from the turn's model prices and the tier's window, with `worstCase` at window plus margin and the output cap, times `turnCallCap`.
- **The bound is `budget + 2 × grace` per spend subject.** Other turns stop at budget plus grace, and the last turn can add at most its own maximum. Do not describe it as a smaller figure.
- **The check stays inside the admission transaction**, so parallel calls still see each other's reservations. It needs one new query for a turn's spend.
- **A paused day:** a continuation is admitted only when its turn has no call started at or after the pause began. A lifted pause refuses nothing.
- **Reaching the ceiling:** admission uses the pause check's answer rather than discarding it. A first call whose reservation would reach the ceiling starts the pause and is refused, with no row kept. A continuation that reaches it starts the pause and uses that turn's grace call. The pause must survive the refusal, so the refusal cannot roll it back.
- **Tier guard:** a tier outside `TIER_KEYS` yields no config, before any limit is read.
- **Words to update:** the Turn and Pause glossary entries in both repos, the pause alert text, and the server guide all say started turns finish.

### Entitlement freshness (FormamorphServer)

- **The cutoff lives in `entitlement()`.** A pledge whose `checked_at` is older than 7 days, or null while it holds a tier, does not count. The cutoff is a server constant.
- **A live grant still counts**, so a grant can serve an account whose pledge is unconfirmed, on the grant's own spend subject.
- **The result says why.** The proxy refuses with a new refusal code, and the Hosted state reports a matching new state, so the client can show it before any call. Tickets name both in the glossary's words.
- **Only the proxy and the Hosted state change.** Flair and the wall keep reading the tier.
- **Recovery needs no action.** Any successful read refreshes `checked_at`, and service resumes on the next call.
- **Reconcile alert:** count consecutive failed hourly runs in a stored setting, as the balance alert does, so a restart does not reset the count. Alert once on the third failure with `alertAdmins`. A success clears the count and allows a later alert. An unconfigured server runs nothing and counts nothing.
- **Webhook deliveries:** the signature check does not change. An ending trigger clears the tier at once from the delivery, which keeps the rule that a lapse ends access at once. Every tier trigger, ending included, then asks for a read of the member list. The server answers before the read finishes, and a burst of deliveries shares one read.
- **A read decides.** A successful read sets links through the reconcile path. If it fails, an ending stays applied and other deliveries change nothing, until the next hourly run. Only hourly runs count toward the alert.

### Turns-left correctness (FormamorphServer)

- `recentTurnCosts` counts only turns with a call whose prompt type is narration. The header is client-supplied, but a false value can change only that account's own figure.

### Client (formamorph)

- **Hosted state** gains `turnLimitSeconds`, which the server adds and the client parses. A null value means no client expiry.
- **Turn expiry:** `HostedTurn` starts its clock when the opening call is sent, which is before the server starts its own. After the limit less a margin, the turn clears its id and the next call opens a new turn. The margin covers the time a call takes to reach the server.
- **A turn in progress can expire**, for example while a During-AI-Output script waits for the player. The passes after that open a new turn and face the budget check.
- **New refusal and state:** add them to the mirrored refusal list, the state list and every surface that shows the Hosted state. The site's account surface is included if it reads the state.
- **Allowance surface:** one line explains that background work pauses when the week is spent. Fixed copy never names a weekday.
- **Copy** follows the Writing Guide, written from a facts list in the player's words.

### Turn call cap

- Measure a worst-case turn with the free fake-reply harness, using Staged thinking, full cast, diaries and discoveries, with tool rounds and schema fallback counted separately.
- The fixtures show a cap of 20, and the client's worst case before multipliers reaches about 22 with three characters. The ticket reports the numbers, and the user sets the live value. The value never enters the repo.

## Testing Decisions

- **Test behavior through the highest seam:** what a client sees over HTTP and what reaches the fake upstream. Do not assert internals.
- **Seams (Q27), all existing:**
  - The real hosted route over HTTP against a fake upstream (prior art: the metering, limits and proxy suites).
  - The signed webhook route and the reconcile job with the Patreon client swapped (prior art: the webhook and reconcile suites).
  - The hosted stream call with a fake fetch and clock (prior art: the request transport and hosted turn tests).
- **The spend suite** runs the stockpile attack with the budget spent through real calls, and asserts total spend stays within the stated bound however many turns are held. It also shows that an honest turn under budget finishes past the budget.
- **The entitlement suite** keeps the bypass probes as a permanent guard: tier fields in the body and headers, retired tokens, route variants, suspended accounts and forged or misused link tokens.
- **Prove each guard bites.** Reinstate each bug and watch its test fail.
- **Existing tests that must stay green:** a started turn finishes past the budget, and an unknown or foreign turn id gets `turn_expired`.
- **Tests that may change:** any test that asserts a call reaching the ceiling is admitted, or that a paused day lets a turn run on without limit. Only these rulings justify the change.
- **Cover the edges:** 7-day boundary, grant beside an unconfirmed pledge, flair unchanged, third failure alerts once, success clears the count, a stale delivery cannot restore a tier, an ending survives a failed read, turn expiry just before and after the margin, and a null limit.

## Out of Scope

- Reserving a whole turn when it opens (Q1).
- A minimum turn charge (Q16).
- Delivery-id or content-hash dedupe, and capturing real deliveries (Q11, Q31).
- Running the API as more than one process. The server guide already forbids it.
- Sign-in, JWT secret rotation, Caddy and TLS. The audit did not cover them.
- Setting live budgets, caps or tier text. Those are the user's server settings.

## Further Notes

- **Unverified: Patreon's member list may lag behind a webhook.** If it does, an upgrade can wait for a later read, and a read can restore an ended tier until the next one. The webhook ticket checks this on the first real delivery it can observe and reports back.
- **Undocumented by Patreon:** headers beyond `X-Patreon-Event` and `X-Patreon-Signature`, whether a retry is byte-identical, how accumulated events arrive, and what counts as a failed delivery. Nothing here depends on them.
- **No export-shape change.** World and save files do not change. The Hosted state and the refusal list change, and neither has been released.
- The red repro and the audit probes are untracked in the server's `tests/` folder until their tickets fold them in. Do not commit them before the fix.
