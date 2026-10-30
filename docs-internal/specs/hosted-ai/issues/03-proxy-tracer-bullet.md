# 03: Proxy Tracer Bullet

Status: ready-for-human
Base: 19294c3
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai/spec.md` in formamorph (Tiers and entitlement, Spend subject, Server proxy, Server settings)

Model rationale: a new public route that spends money and carries explicit player text; every guard is a security or billing boundary.

**What to build:** an entitled, 18+ account sends an OpenAI-compatible chat-completions request, streamed or not, to the new proxy route and gets the upstream reply streamed back. Admission covers auth, client version, age gate, entitlement (Patreon tier) and the window refusal shape; metering, budgets and limits come in later tickets. This ticket creates the admin-only hosted settings record with the approved model list and the active model, and owns the refusal code list that the client mirrors.

- [x] The route answers only through `protect`, the per-route client-version check, a direct age-gate acceptance check that refuses when acceptance can't be confirmed, and a Patreon-tier entitlement check; each refusal has its code from the spec, in the server's error shape. ("admission" tests in `tests/hostedAiProxy.test.js`; the client version is the existing `client_minimums` gate per the spec ruling, 426 `CLIENT_UPDATE_REQUIRED`)
- [x] The upstream body is built from the allow-list; `n`, `user`, routing fields, caching fields and unknown keys never reach upstream; `max_tokens` is required and capped. ("keeps only allow-listed fields...", "requires max_tokens and caps it", "refuses a body that is not a chat completion")
- [x] The active model entry sets the model and routing options; a client-sent model is ignored. Upstream prompt caching is never enabled. ("follows the active model entry"; `cache_control` dropped at top level, in parts, tools, tool calls and schemas)
- [x] The upstream `user` field is an HMAC of the spend subject (Patreon user id) with a dedicated env secret. ("gives each spend subject its own stable anonymous id", plus the exact HMAC in the allow-list test)
- [x] The upstream key comes only from the environment; it appears in no settings row, response or log. ("sends the key from the environment and never returns it", "has no place for the upstream key", the logging test)
- [x] Image content parts are refused with `image_not_supported`. ("refuses image content parts")
- [x] The route has its own JSON body limit sized for the largest window and skips the global IP rate limiter. (8 MB route parser, "refuses a body over the route limit"; "is not counted by the global per-address rate limit", 1,001 requests)
- [x] Streams pass through unchanged; a client disconnect aborts the upstream call; an upstream that is silent past the idle limit is aborted and the stream ends with an SSE error event. ("passes a stream through unchanged", "passes events split across chunks through unchanged", "aborts the upstream call when the client disconnects", "aborts an upstream that is silent past the idle limit", "lets a slow upstream finish")
- [x] A failure after headers are sent ends with an SSE error event. ("ends with an SSE error event when the upstream fails after the headers"; an upstream error inside a 200 reply is replaced too, per the spec ruling)
- [x] No request or upstream body reaches any log, including on a parse error (test spies on the logger). ("writes no request or upstream text to any log, a parse error included" spies on console, stdout and stderr)
- [x] The hosted settings record exists, admin-only (moderators get 403), with the approved model list and active model; the active entry can't be removed. (`hosted_ai` setting; "the hosted settings record" tests)
- [x] One refusal code list lives in one module with a test that pins it. (`REFUSALS` in `src/config/hostedAi.js`; "the refusal code list is pinned")
- [x] All tests run against a fake upstream; each guard is proven by removing it once. (local fake upstream server; 33 mutations, each turned at least one test red)
- [x] The server docs list the new env variables. (`HOSTED_AI_UPSTREAM_URL`, `HOSTED_AI_API_KEY`, `HOSTED_AI_USER_SECRET` in README.md)

## Landed

**Not verified**
- None of the criteria is left unticked.
- Backpressure on a slow client (the stream waits for `drain`) has no test of its own.
- The route error handler's 500 path, for an error other than a body parse, has no test. Nothing in the route throws there today.

**For you**
- Set `HOSTED_AI_UPSTREAM_URL`, `HOSTED_AI_API_KEY` and `HOSTED_AI_USER_SECRET` in the server `.env` by hand. Generate the secret once and never rotate it.
- Write the `hosted_ai` setting (models, active model, `maxTokensCap`, `idleLimitSeconds`) from the local hosted-tier note. Until then the route answers 503 `service_paused`.
- Add `POST /api/hosted-ai` to `client_minimums` when the client that speaks to it ships.
- The server's `CONTEXT.md` glossary has no entries yet for Formamorph AI, Spend subject or refusal code.
