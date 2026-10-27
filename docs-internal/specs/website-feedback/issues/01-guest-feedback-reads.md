# 01: Guest Feedback Reads

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: the server spec, `docs-internal/specs/website-feedback/spec.md` in FormamorphServer (Contract, Implementation Decisions)

Model rationale: a small change, but it opens an access rule. A wrong type check publishes the bug queue and its diagnostics to the web.

**What to build:** a signed-out visitor can read the Votable boards (suggestions and questions) through the API: the meta, the list with `scope=all`, and one thread with its comments. A guest can never list or read a bug. Guest reads leave no seen-marker and run no vote lookup. Signed-in reads and every write behave exactly as today.

- [ ] A guest `GET /api/feedback/meta` answers 200 with the same body as a signed-in read.
- [ ] A guest list of suggestions or questions with `scope=all` answers 200, and each row carries `voted: false` and `unread: false`.
- [ ] A guest list of type `bug`, or a guest list without `scope=all`, answers 401.
- [ ] A guest read of a suggestion or a question answers 200 with its comments.
- [ ] A guest read of a bug answers 404, the same body as a missing thread.
- [ ] A guest read writes no seen-marker row.
- [ ] `unread-count` and every write route still answer 401 to a guest.
- [ ] The guest bug tests fail when the type check is removed once (the guard bites).
- [ ] The existing signed-in feedback route tests stay green unchanged.
- [ ] The server's API docs (if they list feedback routes as signed-in only) say which reads are open to guests.
