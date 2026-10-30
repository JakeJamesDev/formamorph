# 04: Metering and Budget

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai/spec.md` in formamorph (Spend subject, Admission, Metering)

Model rationale: concurrency-sensitive accounting where a race is a billing hole; needs careful reasoning about reservation and settlement.

**What to build:** every proxied call is metered against its spend subject, and a subject past its monthly budget can't start a new turn. Calls reserve their worst-case cost at admission and settle from the upstream usage block, from token counts times admin prices, or from the estimate. A server-issued turn id lets every call of a started turn finish. The window is enforced from a character-based token estimate with a margin.

- [ ] The usage table and its indexes match the spec; no column holds prompt or reply text; there is no cascading foreign key, and account erasure nulls the account id and keeps the rows.
- [ ] Spend sums by subject: relinking the Patreon membership to another account, or deleting and re-creating the account, keeps the month's spend (tests for both).
- [ ] Each admitted call inserts an `open` row with its worst-case cost before forwarding; parallel first calls can't all pass the same budget sum (test with a hanging fake upstream).
- [ ] Rows settle with cost source `upstream`, `computed` or `estimated` as the spec says, including client abort, upstream error, idle-limit abort and no usage block.
- [ ] The hourly job settles rows still `open` past the turn time limit, and deletes rows past the retention period.
- [ ] The first call of a turn gets a server-issued turn id; later calls with it skip the budget check; an expired id or one past its call cap is refused with `turn_expired`.
- [ ] A first call is refused with `budget_exhausted` (carrying the reset time) once the subject's month sum, open rows included, reaches its tier budget; the month resets at 00:00 UTC on the 1st; a tier change applies against the same sum.
- [ ] `window_exceeded` fires only past the estimate plus margin, carries the current window, and the row records estimated and upstream prompt tokens.
- [ ] Each guard is proven by removing it once.
