# 11: Launch Readiness

Status: ready-for-agent
Blocked by: 05, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai/spec.md` in formamorph (Launch)

Model rationale: a load script and a checklist; the judgment is in reading the results honestly.

**What to build:** before Supporters get access, the proxy is proven under load and the deploy has every piece it needs. A load script drives the proxy at the planned parallel load against a slow fake upstream and reports latency, errors, open rows and counter leaks. The deploy checklist covers the Caddy body cap, the new environment secrets and the closed beta on staff grants.

- [ ] A load script runs the proxy against a fake upstream with configurable delay and reports p50/p90 time to first byte, error count, rows left `open` and parallel counters after the run.
- [ ] After a run, every row is settled and every counter is back to zero.
- [ ] The deploy docs list the Caddy request body cap check, each new environment variable, and the order: deploy, closed beta on staff grants, then open to Supporters.
- [ ] The script and docs hold no provider name or cost figure.

For you: run the load script on the production host during a quiet window and decide when the closed beta ends.
