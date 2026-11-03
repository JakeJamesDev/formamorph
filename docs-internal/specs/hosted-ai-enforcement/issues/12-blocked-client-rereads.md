# 12: Blocked Client Re-Reads the Hosted State

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` (Client, Q33)

Model rationale: one read path with a throttle and a reset timer, in code several surfaces share.

**What to build:** a Supporter whose service has returned does not need to do anything to use it. A client blocked by the `unconfirmed` or `exhausted` state reads the Hosted state again before it refuses a send, with a short throttle. The week's reset also triggers a read in an open app. When the read shows a usable state, the send goes out.

- [ ] A send blocked by `unconfirmed` re-reads the state, and it goes out when the state is usable again.
- [ ] A send blocked by `exhausted` does the same after the week's reset.
- [ ] An open app reads the state when `resetAt` passes, so the Allowance Ring updates with no send.
- [ ] Repeated blocked sends within the throttle make one read, and a background pass that keeps failing cannot flood the state route.
- [ ] A read that still shows a blocked state refuses the send as it does today, with one notice.
- [ ] A `paused` state behaves the same way, because a pause ends at 00:00 UTC or on an admin lift.
- [ ] A timer stops at unmount or sign-out and leaks nothing.
- [ ] Removing the re-read makes a test fail.
