# 01: Guest Feedback Reads

Status: done
Base: 87d5c36
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: the server spec, `docs-internal/specs/website-feedback/spec.md` in FormamorphServer (Contract, Implementation Decisions)

Model rationale: a small change, but it opens an access rule. A wrong type check publishes the bug queue and its diagnostics to the web.

**What to build:** a signed-out visitor can read the Votable boards (suggestions and questions) through the API: the meta, the list with `scope=all`, and one thread with its comments. A guest can never list or read a bug. Guest reads leave no seen-marker and run no vote lookup. Signed-in reads and every write behave exactly as today.

- [x] A guest `GET /api/feedback/meta` answers 200 with the same body as a signed-in read. (`tests/feedbackGuests.test.js` 'gets the same body as a signed-in reader')
- [x] A guest list of suggestions or questions with `scope=all` answers 200, and each row carries `voted: false` and `unread: false`. ('lists the suggestion/question board with scope=all'; 'runs no vote or unread lookup' spies)
- [x] A guest list of type `bug`, or a guest list without `scope=all`, answers 401. ('refuses the bug queue', 'refuses a list with no type', 'refuses a board list without scope=all')
- [x] A guest read of a suggestion or a question answers 200 with its comments. ('reads a suggestion/question with its comments')
- [x] A guest read of a bug answers 404, the same body as a missing thread. ('gets a bug answered as not found, like a missing thread'; the old 401 test in `tests/feedback.test.js` now asserts 404)
- [x] A guest read writes no seen-marker row. ('writes no seen-marker and runs no vote lookup': `feedback_reads` count, `markSeen`/`hasVoted` spies)
- [x] `unread-count` and every write route still answer 401 to a guest. ('gets 401 on unread-count and every write', all 11 routes)
- [x] The guest bug tests fail when the type check is removed once (the guard bites). (removed in `canRead`: the bug-404 test failed; removed in `canList`: both bug-list tests failed; restored and grepped)
- [x] The existing signed-in feedback route tests stay green unchanged. (full `npm test`: 2314 passed, 2 skipped; the one edited test is the guest bug read)
- [x] The server's API docs (if they list feedback routes as signed-in only) say which reads are open to guests. (no server doc lists feedback routes; the route comments and controller `@access` lines say it)

## Landed

Spec-session rulings: a sent Authorization header still meets `protect` exactly (new `protectWhenSent`, not `optionalAuth`); `#N` lookup stays with feedback-links.

**Not verified**

- None unticked. One unnamed failure in one of six runs of the five feedback test files; five reruns were green, so it is recorded as a flake.

**For you**

- A bug converted to a suggestion or question keeps its bug-era comments, and guests can now read them (`Feedback.update` clears only diagnostics). Signed-in readers see them today. Decide whether conversion should hide or clear them.
