# 04: Community service errors carry route, status and body

Status: ready-for-human
Base: b624cf0b
Blocked by: 01 — Details field and headline
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

When a community action fails, such as downloading, liking, filing feedback or a staff moderation call, the toast keeps its message and **View Details →** names the route that failed, the HTTP status and the server's response body. Staff can find the failing request from a pasted error.

Only services that already throw on a failed response change. Services that return a result object keep their shape; their failed results are wrapped at the toast by ticket 01. Auth-bearing routes never include headers in details.

Recommended model rationale: a repetitive change across about ten services with one shared helper; needs discipline more than novel design.

## Acceptance criteria

- [ ] Each throwing community service, given a stubbed failed response, throws an error whose `details` names the route, the status and the body
- [ ] No details text contains an Authorization header or bearer token
- [ ] A Community Creations failure toast offers **View Details →** and the window names the route and status
- [ ] Services that return result objects are unchanged
- [ ] Mutation check: dropping the route from the shared helper fails a test
- [ ] Four gates green
