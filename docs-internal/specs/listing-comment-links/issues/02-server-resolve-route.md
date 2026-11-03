# 02: Server Resolve Route

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q5; Server)

Repo: FormamorphServer

One small route on the existing resolver, with its auth and rate limit modeled on the feedback search routes.

## What to build

`POST /api/feedback/links/resolve` takes `{ text }` and returns `{ targets }` for that text, resolved for the signed-in reader. It stores nothing. It sits with the feedback search routes, with a per-account rate limit, and accepts text up to the longest feedback body.

## Acceptance criteria

- [ ] A signed-in request returns the same `targets` a posted comment with that text would carry. Test: an HTTP request compared to a posted comment's targets.
- [ ] A signed-out request is refused. Test: HTTP request.
- [ ] A request over the rate limit is refused. Test: HTTP requests.
- [ ] Text over the length limit is refused. Test: HTTP request.
- [ ] Results depend on the reader: a thread the reader can't read arrives as unavailable. Test: HTTP request.
- [ ] A call writes no rows. Test: mention rows and comment counts are unchanged after a call.
