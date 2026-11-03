# 06: Webhook Delivery Triggers a Member-List Read

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Entitlement freshness, Q11, Q20, Q28)

Model rationale: background work after the response, with ordering and failure paths to get right.

**What to build:** a stale or repeated webhook delivery cannot restore an ended tier, because the member list decides. A signed delivery with a tier trigger asks for a read of the member list. An ending trigger also clears the tier at once from the delivery. The server answers before the read finishes, and a burst shares one read.

- [ ] A repeated create delivery after an ending does not restore the tier when the list shows none.
- [ ] A non-ending delivery changes a tier only through a successful read, and it does not refresh `checked_at` by itself, so a replay cannot extend the 7-day cutoff.
- [ ] An ending applies at once and stays applied when the read fails.
- [ ] A non-ending delivery changes nothing when the read fails.
- [ ] A burst of deliveries makes one read.
- [ ] A failed delivery-triggered read does not count toward the alert.
- [ ] The signature tests still pass, and an unsigned delivery triggers no read.
- [ ] The Patreon glossary entries and the server guide state the rule.

For you: on the first real upgrade after deploy, check whether the new tier appeared at once. If it took a later read, tell the spec session, because the member list lags behind webhooks.
