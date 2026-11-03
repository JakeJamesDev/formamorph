# 13: Proxy Stop and Retry

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/first-time-flow/spec.md` in formamorph (Q54)

Model rationale: stream buffering, abort and spend accounting in a path that holds money and a parallel slot.

**What to build:** when thinking is off for the active model and a call starts thinking, or its stream fails before any reply text, the proxy stops the call and sends it upstream once more. The client sees one normal call. A failed planning call today can lose the whole turn, so the player has to send the action again (Q54).

- [ ] The proxy holds a stream's frames until the first frame with reply text or a tool call, then forwards the held frames and continues as today.
- [ ] Before that point, a thinking delta on a model with thinking off, an upstream error frame, or a stream that ends early stops the call and retries it once. A thinking delta on a model with thinking on never triggers this.
- [ ] A non-streamed call that returns thinking with no reply text retries once on the same terms.
- [ ] After reply text has reached the client, nothing retries, and a failure ends the call as it does today.
- [ ] A failed retry answers as today's `upstream_error`, so the client's handling doesn't change. Two attempts is the limit.
- [ ] The retry holds the same parallel slot, and a client disconnect aborts whichever attempt is running.
- [ ] A retry doesn't count toward the turn call cap, or toward the per-minute limit.
- [ ] A stopped attempt counts toward the day's recorded spend, so the provider reconcile stays accurate, and never toward the player's allowance. The usage row shows it was stopped.
- [ ] The first-byte clock and idle limit apply to each attempt. The turn limit still applies across both.
- [ ] Each case above has a test against the fake upstream. Removing the retry fails them.
- [ ] A live run plays turns through the proxy and reports, in chat only, how many calls retried and how many retries succeeded, including whether a retry lands on the same failure. No counts or costs go in a tracked file.
- [ ] A changelog fragment states what changed for the player.

For you: whether stopped attempts stay off the player's allowance once you see the live spend. A deploy of the server.
