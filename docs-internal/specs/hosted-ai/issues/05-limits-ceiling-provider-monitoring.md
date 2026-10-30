# 05: Limits, Daily Ceiling and Provider Monitoring

Status: ready-for-human
Base: 23a02ed
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai/spec.md` in formamorph (Admission, Metering)

Model rationale: the last line of defense against a runaway bill; counters must release on every exit path and the pause logic has day-boundary edges.

**What to build:** one account can't flood the proxy, and the whole service pauses before spend runs away. Per-account parallel and per-minute limits apply to every call. A global daily ceiling pauses new turns, alerts admins once, and can be lifted by an admin until 00:00 UTC. The server watches the provider balance and stores the provider's daily spend. This ticket owns the pause read and lift routes.

- [x] Per-account parallel and per-minute limits refuse with `rate_limited`, counted per account, never per IP; the parallel counter is released on close, error, abort and refusal (test with a hanging fake upstream). Tests: the `parallel limit` block (limit, another account admitted from the same address, release on close, upstream 500, client abort, window and invalid refusals) and the `per-minute limit` block (60 s window, release after a minute refusal).
- [x] When the day's sum, open rows included, reaches the ceiling, new first calls get `service_paused` and calls of admitted turns finish. Tests: `pauses new turns once the day, open rows included, reaches the ceiling; started turns finish`, `pauses on the reservation that reaches the ceiling`, `pauses when a settled cost reaches the ceiling, with no new turn`.
- [x] The pause alerts admins once: email to the staff address from the environment (when mail is enabled) and an in-app admin message. Test: `alerts the admins once` (3 refusals, 1 urgent message to the admin, none to a mod, 1 mail to `STAFF_ALERT_EMAIL`).
- [x] An admin lift holds until 00:00 UTC; the check restarts with the new day; moderators can't lift. Tests: `lets an admin lift the pause until 00:00 UTC` (23:59 to 00:00, re-pause and a second alert on the new day), `ends an unlifted pause at 00:00 UTC`, mod 403.
- [x] The hourly job reads the provider balance with the server key and alerts admins once when it falls below the threshold. Tests: the `provider balance` block (POST with `x-api-key`, once per crossing, re-armed above the threshold, skipped without a threshold, no alert without `usd_balance`).
- [x] A daily job stores the provider's per-day spend for the server key next to the recorded day sum. Runs hourly: it stores each complete UTC day since the last stored one and reads the last two again. Tests: the `provider daily spend` block; ticket 06's spend report test now reads the real table.
- [x] Provider calls in tests hit a fake; no test reaches the network. Every URL in `hostedAiLimits.test.js` points at one local fake server.
- [x] Each guard is proven by removing it once. 33 mutations from a scratch script, each red on its own test, with sources restored byte for byte. The hosted-state `paused` branch was checked the same way.

## Landed

**Not verified**
- None of the criteria is left unticked.
- Mail goes out only when `STAFF_ALERT_EMAIL` is set. Without `RESEND_API_KEY`, the no-key transport refuses it and the server logs one error per alert.
- A call that the per-minute limit refuses does not count against the minute, so an account that keeps retrying is not locked out. Calls refused later, at budget or window, do count.
- The limits live in process memory, like ticket 04's single-process admission. A restart clears them.
- Added beyond the ticket, at the spec session's request: the hosted state says `paused` while the day is paused, and ticket 06's spend report reads `hosted_provider_spend` with no table-exists guard.

**For you**
- Add the new keys to the `hosted_ai` setting from the local hosted-tier note: `parallelLimit`, `perMinuteLimit`, `dailyCeiling` (dollars, above zero) and optionally `balanceThreshold` (dollars). Until the first three are set, the proxy answers 503 `service_paused`.
- Add `HOSTED_AI_BALANCE_URL`, `HOSTED_AI_USAGE_URL` and `STAFF_ALERT_EMAIL` to the server `.env` by hand.
- The field names the code parses (`usd_balance`, `byDay`, `netCostUsd`) and the `x-api-key` header match one provider's API. No name appears, but together they point at it. Decide whether that is acceptable.
