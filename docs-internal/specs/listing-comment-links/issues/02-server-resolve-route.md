# 02: Server Resolve Route

Status: done
Base: a6002e4
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q5; Server)

Repo: FormamorphServer

One small route on the existing resolver, with its auth and rate limit modeled on the feedback search routes.

## What to build

`POST /api/feedback/links/resolve` takes `{ text }` and returns `{ targets }` for that text, resolved for the signed-in reader. It stores nothing. It sits with the feedback search routes, with a per-account rate limit, and accepts text up to the longest feedback body.

## Acceptance criteria

- [x] A signed-in request returns the same `targets` a posted comment with that text would carry. Test: an HTTP request compared to a posted comment's targets. (`returns the targets a posted comment with that text carries`)
- [x] A signed-out request is refused. Test: HTTP request. (`refuses a guest`, 401)
- [x] A request over the rate limit is refused. Test: HTTP requests. (`is rate limited per account`, 429 on request 61)
- [x] Text over the length limit is refused. Test: HTTP request. (`refuses text over the longest feedback body`, 400 at 4001, 200 at 4000)
- [x] Results depend on the reader: a thread the reader can't read arrives as unavailable. Test: HTTP request. (`resolves for the reader`: missing thread and hidden listing unavailable; see Landed)
- [x] A call writes no rows. Test: mention rows and comment counts are unchanged after a call. (`writes no rows`: feedback, comment and mention row counts)

## Landed

**Not verified**
- None unticked. One criterion is narrower than written: every signed-in reader can read every thread (`Feedback.canRead`), so no signed-in request can see a thread as unreadable. The route needs sign-in, so only a missing thread or a hidden listing arrives as unavailable. Bug threads resolve as available for any signed-in reader.

**For you**
- Spec session: confirm the narrower reading of the reader-dependence criterion. Ticket 06 and the site's bug-thread rule (Q8) are the website's concern, as guests never reach this route.
- Response shape is `{ success: true, data: { targets } }`, and the limiter is 60/min per account, as the spec session ruled.
- No changelog fragment: the server repo has no changelog config. The spec's changelog entries belong to the client tickets.
