# 04: Metering and Budget

Status: ready-for-human
Base: c37ebfa
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai/spec.md` in formamorph (Spend subject, Admission, Metering)

Model rationale: concurrency-sensitive accounting where a race is a billing hole; needs careful reasoning about reservation and settlement.

**What to build:** every proxied call is metered against its spend subject, and a subject past its monthly budget can't start a new turn. Calls reserve their worst-case cost at admission and settle from the upstream usage block, from token counts times admin prices, or from the estimate. A server-issued turn id lets every call of a started turn finish. The window is enforced from a character-based token estimate with a margin.

- [x] The usage table and its indexes match the spec; no column holds prompt or reply text; there is no cascading foreign key, and account erasure nulls the account id and keeps the rows. Tests: `the usage table` (columns, two indexes, `foreign_key_list` empty, no text after a secret prompt) and `keeps the month, and the rows, when the account is erased`.
- [x] Spend sums by subject: relinking the Patreon membership to another account, or deleting and re-creating the account, keeps the month's spend (tests for both). Tests: `keeps the month when the Patreon membership moves` and `... erased and made again`.
- [x] Each admitted call inserts an `open` row with its worst-case cost before forwarding; parallel first calls can't all pass the same budget sum (test with a hanging fake upstream). Tests: `records an open row with the worst case before the upstream answers`; `admits parallel first calls only while the reservations before them stay under the budget` (6 parallel, 4 admitted).
- [x] Rows settle with cost source `upstream`, `computed` or `estimated` as the spec says, including client abort, upstream error, idle-limit abort and no usage block. Tests: the `settlement` block, one test per path, plus a cost-only usage block and tool-call characters.
- [x] The hourly job settles rows still `open` past the turn time limit, and deletes rows past the retention period. Tests: `settles a row still open past the turn limit` (a late settle leaves it) and `deletes rows past the retention period`.
- [x] The first call of a turn gets a server-issued turn id; later calls with it skip the budget check; an expired id or one past its call cap is refused with `turn_expired`. Tests: the `turns` block (issue, skip budget, time limit, call cap, unknown and foreign ids, CORS both ways).
- [x] A first call is refused with `budget_exhausted` (carrying the reset time) once the subject's month sum, open rows included, reaches its tier budget; the month resets at 00:00 UTC on the 1st; a tier change applies against the same sum. Tests: the `monthly budget` block, with the clock at 23:59 on Oct 31 and 00:00 on Nov 1.
- [x] `window_exceeded` fires only past the estimate plus margin, carries the current window, and the row records estimated and upstream prompt tokens. Tests: `refuses only past the window plus the margin` (edge admitted, one under refused), `counts tool schemas`, `records the upstream prompt count`.
- [x] Each guard is proven by removing it once. 26 mutations run from a scratch script, each red on its own test, sources restored byte-for-byte.
- [x] The server's `CONTEXT.md` glossary gains entries for Formamorph AI, Spend subject and refusal code (left open by ticket 03). Added, with Turn and Reservation.

## Landed

**Not verified**
- None of the criteria is left unticked.
- A call still streaming past the turn time limit is swept at its worst case, and its real settle is then dropped. This matches the spec's sweep rule and only overcharges. It needs a call longer than the turn limit.
- A settle write that fails is logged and left for the sweep. No test forces that write to fail.
- Admission is safe only while the API runs as one process: the check and the reservation share one synchronous transaction.

**For you**
- Add to the `hosted_ai` setting from the local hosted-tier note: model `prices` (dollars per million tokens: `prompt`, `completion`, optional `cached`), `tiers` (window and monthly budget in dollars per tier key), `tokenRatio`, `tokenMargin`, `turnLimitSeconds`, `turnCallCap`, `retentionDays`. Until then the proxy answers 503 `service_paused`.
