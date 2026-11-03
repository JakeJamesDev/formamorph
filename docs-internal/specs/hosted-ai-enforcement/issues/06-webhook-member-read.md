# 06: Webhook Delivery Triggers a Member-List Read

Status: ready-for-human
Base: 10fec3d
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Entitlement freshness, Q11, Q20, Q28)

Model rationale: background work after the response, with ordering and failure paths to get right.

**What to build:** a stale or repeated webhook delivery cannot restore an ended tier, because the member list decides. A signed delivery with a tier trigger asks for a read of the member list. An ending trigger also clears the tier at once from the delivery. The server answers before the read finishes, and a burst shares one read.

- [x] A repeated create delivery after an ending does not restore the tier when the list shows none. (test "a repeated create after an ending…")
- [x] A non-ending delivery changes a tier only through a successful read, and it does not refresh `checked_at` by itself, so a replay cannot extend the 7-day cutoff. (tests "a non-ending delivery changes no tier and no checked_at…", "…so a replay cannot extend the cutoff"; acting on the payload fails both)
- [x] An ending applies at once and stays applied when the read fails. (tests "an ending applies at once…", "an ending stays applied when the read fails", "…when the read after a stale read fails")
- [x] A non-ending delivery changes nothing when the read fails. (test "a non-ending delivery changes nothing when the read fails…")
- [x] A burst of deliveries makes one read, through ticket 05's `refreshLinksFromMembers()`, which throws on failure and does not count. (test "a burst of deliveries makes one read"; reconcile test "counts a failed run of the shared read nowhere")
- [x] A failed delivery-triggered read does not count toward the alert. (test "a failed delivery read does not count toward the alert"; calling the hourly run instead fails it)
- [x] The signature tests still pass, and an unsigned delivery triggers no read. (signature suite; each refusal now also asserts no read while the list shows a new tier)
- [x] The Patreon glossary entries and the server guide state the rule. (`CONTEXT.md`, `docs-internal/server.md`)

## Landed

**Not verified**
- A real Patreon delivery. All tests use a fake Patreon client, so the member-list lag stays unknown.
- The unconfigured guard through the route. The test calls `requestMemberRead()` on a reloaded module, because the running app keeps its loaded config.

**For you**
- For you: on the first real upgrade after deploy, check whether the new tier appeared at once. If it took a later read, tell the spec session, because the member list lags behind webhooks.

**Build notes**
- The review found that a stale read could undo an ending, and that this survived a failed trailing read. A delivery during a read now voids that read's list, so the read writes nothing and the trailing read decides. This also applies to an hourly run, which then reports success without stamping `checked_at`.
- The 5-second wait is a fixed window from the first delivery, not a reset, so a stream cannot defer the read. A burst longer than 5 seconds can make more than one read.
