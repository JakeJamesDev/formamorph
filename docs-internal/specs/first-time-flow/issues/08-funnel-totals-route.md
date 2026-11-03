# 08: Funnel Totals Route

Status: ready-for-human
Base: 1558d25
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/first-time-flow/spec.md` in formamorph (Anonymous totals)

Model rationale: one small table and route, following the anonymous-like precedent.

**What to build:** a public route counts how many players reach each funnel step, per day, with nothing that identifies anyone. Staff can read the totals. The privacy policy says what is counted.

- [x] A POST takes one step name from a fixed list: offer shown, See Levels, Patreon click, checklist finished. It increments today's total, and an unknown step is refused. (`funnelTotals.test.js`: "adds one to today's total…", "refuses an unknown step…"; the check removed, the test went red.)
- [x] The route stores no IP, install ID or account. A test reads the stored row and finds only the step, the day and the count. ("stores only the step, the day and the count": columns and stored JSON read back.)
- [x] A per-route limiter follows `likeLimiter`, and a test proves it bites. ("gives each address a budget of its own…": the 31st post gets 429; limiter removed, test red.)
- [x] An admin read returns the totals by day. (Admin-only per spec ruling Q41; guest 401, normal and moderator 403.)
- [x] The privacy policy text gains a line about these totals, and the policy's version handling follows what the server already does for a change. (New section; no re-accept, so `publish-policy` runs without the flag.)
- [x] The server's docs for the route are current. (README "Offer funnel totals".)

For you: the privacy policy line's wording, before it deploys.

## Landed

**Not verified**
- The policy text reaching the live row: it needs `npm run publish-policy` after deploy, which I did not run.

**For you**
- The privacy policy line's wording: section "Counting the Formamorph AI offer" in `src/assets/policies/privacy-policy.md` (FormamorphServer).
- The no-re-accept call: the line ships without `requireReaccept`, so nobody is asked again. Decide before deploy.
