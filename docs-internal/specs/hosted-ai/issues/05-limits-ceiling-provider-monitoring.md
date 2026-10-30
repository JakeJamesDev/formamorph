# 05: Limits, Daily Ceiling and Provider Monitoring

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai/spec.md` in formamorph (Admission, Metering)

Model rationale: the last line of defense against a runaway bill; counters must release on every exit path and the pause logic has day-boundary edges.

**What to build:** one account can't flood the proxy, and the whole service pauses before spend runs away. Per-account parallel and per-minute limits apply to every call. A global daily ceiling pauses new turns, alerts admins once, and can be lifted by an admin until 00:00 UTC. The server watches the provider balance and stores the provider's daily spend. This ticket owns the pause read and lift routes.

- [ ] Per-account parallel and per-minute limits refuse with `rate_limited`, counted per account, never per IP; the parallel counter is released on close, error, abort and refusal (test with a hanging fake upstream).
- [ ] When the day's sum, open rows included, reaches the ceiling, new first calls get `service_paused` and calls of admitted turns finish.
- [ ] The pause alerts admins once: email to the staff address from the environment (when mail is enabled) and an in-app admin message.
- [ ] An admin lift holds until 00:00 UTC; the check restarts with the new day; moderators can't lift.
- [ ] The hourly job reads the provider balance with the server key and alerts admins once when it falls below the threshold.
- [ ] A daily job stores the provider's per-day spend for the server key next to the recorded day sum.
- [ ] Provider calls in tests hit a fake; no test reaches the network.
- [ ] Each guard is proven by removing it once.
