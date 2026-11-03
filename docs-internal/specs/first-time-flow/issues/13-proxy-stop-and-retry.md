# 13: Proxy Stop and Retry

Status: done
Base: 622cac4
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/first-time-flow/spec.md` in formamorph (Q54)

Model rationale: stream buffering, abort and spend accounting in a path that holds money and a parallel slot.

**What to build:** when thinking is off for the active model and a call starts thinking, or its stream fails before any reply text, the proxy stops the call and sends it upstream once more. The client sees one normal call. A failed planning call today can lose the whole turn, so the player has to send the action again (Q54).

- [x] The proxy holds a stream's frames until the first frame with reply text or a tool call, then forwards the held frames and continues as today. `holding a stream` tests in `tests/hostedAiRetry.test.js`. Per the spec session, a thinking frame on a thinking-on model also ends the hold.
- [x] Before that point, a thinking delta on a model with thinking off, an upstream error frame, or a stream that ends early stops the call and retries it once. A thinking delta on a model with thinking on never triggers this. `thinking` and `a stream that fails before any reply text` tests.
- [x] A non-streamed call that returns thinking with no reply text retries once on the same terms. `a non-streamed call` tests.
- [x] After reply text has reached the client, nothing retries, and a failure ends the call as it does today. `after reply text has reached the client` tests.
- [x] A failed retry answers as today's `upstream_error`, so the client's handling doesn't change. Two attempts is the limit. `answers a failed retry as upstream_error, after exactly two attempts`.
- [x] The retry holds the same parallel slot, and a client disconnect aborts whichever attempt is running. `holds the same parallel slot` and `a client disconnect` tests.
- [x] A retry doesn't count toward the turn call cap, or toward the per-minute limit. `takes one per-minute count`, `takes one turn-cap slot`, `keeps the turn-cap slot when both attempts fail`.
- [x] A stopped attempt counts toward the day's recorded spend, so the provider reconcile stays accurate, and never toward the player's allowance. The usage row shows it was stopped. `spend` tests; the row's `stopped` column.
- [x] The first-byte clock and idle limit apply to each attempt. The turn limit still applies across both. `fresh idle clock`, `applies the idle clock to the retry too`, `sends no retry past the turn limit`. The idle timer is the first-byte clock (Q58).
- [x] Each case above has a test against the fake upstream. Removing the retry fails them. Mutation run: disabling the retry turned the retry tests red, and each other guard turned its own test red.
- [x] A live run plays turns through the proxy and reports, in chat only, how many calls retried and how many retries succeeded, including whether a retry lands on the same failure. No counts or costs go in a tracked file. Two runs on a local proxy; counts in chat.
- [x] A changelog fragment states what changed for the player. Handed to the spec session, because this repo has no changelog. The line is below.

For you: whether stopped attempts stay off the player's allowance once you see the live spend. A deploy of the server.

## Landed

**Not verified**

- Everything is verified on a local proxy with a scratch database. The deployed server is not, because the deploy is yours.

**For you**

- For you: whether stopped attempts stay off the player's allowance once you see the live spend. A deploy of the server. Where to look: the admin spend report and the `stopped` column of `hosted_usage`.
- The thinking stop fires only when the live model entry sets `reasoning.enabled` to false or `reasoning.effort` to `none`. Check that entry in the server's hosted settings. Errors and early stream ends retry either way.

**Changelog line, for the spec session**

- **Fewer lost turns on Formamorph AI.** When a call fails before any reply text, the server now tries it once more, so you don't have to send the action again.

**Behavior worth knowing**

- The hold ends when bytes reach the client. Reply text and an error in one upstream chunk still retry, because nothing was sent.
- A streamed upstream refusal of any status retries, including 4xx.
