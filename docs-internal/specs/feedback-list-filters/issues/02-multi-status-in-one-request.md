# 02: Multi-Status in One Request

Status: in-progress
Base: 32612c5e
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

**Parent:** [Feedback List Search and Filters](../spec.md)

**Work tree:** the FormamorphServer repo first, then this repo. The server holds a copy of the spec at the same path. The client part ships only after the user deploys the server.

**What to build:** A staff member filters a queue to Unresolved or Still Open, and every page is complete. The list endpoint accepts a comma-separated status list (Q2). It keeps each value valid for the type and drops the rest. No valid value means no status filter. A single status works as before. `total` counts every match.

The client sends the list in one request. The per-status fan-out, its `truncated` result, and the list's incomplete-page warning go away.

- [ ] Server: a status list returns the union of those statuses, newest first, with an exact `total`
- [ ] Server: invalid values drop; all-invalid means unfiltered; one status works as before
- [ ] Server: status list combines with category and scope
- [ ] Client: `FeedbackService.list` sends one request with the comma-separated list
- [ ] Client: the fan-out, `truncated`, and the warning are gone
- [ ] Server tests over supertest; client test at the `FeedbackService.list` seam with fetch mocked
- [ ] Changelog line under In Progress (client); the deploy log is the user's
