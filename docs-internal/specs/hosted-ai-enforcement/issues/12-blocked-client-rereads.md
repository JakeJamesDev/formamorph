# 12: Blocked Client Re-Reads the Hosted State

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` (Client, Q33)

Model rationale: one read path with a throttle and a reset timer, in code several surfaces share.

**What to build:** a Supporter whose service has returned does not need to do anything to use it. A client blocked by the `unconfirmed` or `exhausted` state reads the Hosted state again before it refuses a send, with a short throttle. The week's reset also triggers a read in an open app. When the read shows a usable state, the send goes out.

- [x] A send blocked by `unconfirmed` re-reads the state, and it goes out when the state is usable again.
- [x] A send blocked by `exhausted` does the same after the week's reset.
- [x] An open app reads the state when `resetAt` passes, so the Allowance Ring updates with no send.
- [x] Repeated blocked sends within the throttle make one read, and a background pass that keeps failing cannot flood the state route.
- [x] A read that still shows a blocked state refuses the send as it does today, with one notice.
- [x] A `paused` state behaves the same way, because a pause ends at 00:00 UTC or on an admin lift.
- [x] A timer stops at unmount or sign-out and leaks nothing.
- [x] Removing the re-read makes a test fail.

## Landed

**Not verified**
- The `useEffect` in `HostedAiStateSync` that calls `watchRecovery` has no component test. The session method it calls is tested.
- A canceled send waits for the re-read before it aborts, because the re-read takes no signal.

**For you**
- Nothing a player can judge. The rulings applied: 30-second throttle, a pause timer at the next 00:00 UTC, no retry after a timer read that still shows a block, and a started turn in `unconfirmed` still re-reads.
