# 08: Funnel Totals Route

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/first-time-flow/spec.md` in formamorph (Anonymous totals)

Model rationale: one small table and route, following the anonymous-like precedent.

**What to build:** a public route counts how many players reach each funnel step, per day, with nothing that identifies anyone. Staff can read the totals. The privacy policy says what is counted.

- [ ] A POST takes one step name from a fixed list: offer shown, See Levels, Patreon click, checklist finished. It increments today's total, and an unknown step is refused.
- [ ] The route stores no IP, install ID or account. A test reads the stored row and finds only the step, the day and the count.
- [ ] A per-route limiter follows `likeLimiter`, and a test proves it bites.
- [ ] An admin read returns the totals by day.
- [ ] The privacy policy text gains a line about these totals, and the policy's version handling follows what the server already does for a change.
- [ ] The server's docs for the route are current.

For you: the privacy policy line's wording, before it deploys.
