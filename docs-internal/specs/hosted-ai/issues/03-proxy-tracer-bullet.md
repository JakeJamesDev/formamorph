# 03: Proxy Tracer Bullet

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai/spec.md` in formamorph (Tiers and entitlement, Spend subject, Server proxy, Server settings)

Model rationale: a new public route that spends money and carries explicit player text; every guard is a security or billing boundary.

**What to build:** an entitled, 18+ account sends an OpenAI-compatible chat-completions request, streamed or not, to the new proxy route and gets the upstream reply streamed back. Admission covers auth, client version, age gate, entitlement (Patreon tier) and the window refusal shape; metering, budgets and limits come in later tickets. This ticket creates the admin-only hosted settings record with the approved model list and the active model, and owns the refusal code list that the client mirrors.

- [ ] The route answers only through `protect`, the per-route client-version check, a direct age-gate acceptance check that refuses when acceptance can't be confirmed, and a Patreon-tier entitlement check; each refusal has its code from the spec, in the server's error shape.
- [ ] The upstream body is built from the allow-list; `n`, `user`, routing fields, caching fields and unknown keys never reach upstream; `max_tokens` is required and capped.
- [ ] The active model entry sets the model and routing options; a client-sent model is ignored. Upstream prompt caching is never enabled.
- [ ] The upstream `user` field is an HMAC of the spend subject (Patreon user id) with a dedicated env secret.
- [ ] The upstream key comes only from the environment; it appears in no settings row, response or log.
- [ ] Image content parts are refused with `image_not_supported`.
- [ ] The route has its own JSON body limit sized for the largest window and skips the global IP rate limiter.
- [ ] Streams pass through unchanged; a client disconnect aborts the upstream call; an upstream that is silent past the idle limit is aborted and the stream ends with an SSE error event.
- [ ] A failure after headers are sent ends with an SSE error event.
- [ ] No request or upstream body reaches any log, including on a parse error (test spies on the logger).
- [ ] The hosted settings record exists, admin-only (moderators get 403), with the approved model list and active model; the active entry can't be removed.
- [ ] One refusal code list lives in one module with a test that pins it.
- [ ] All tests run against a fake upstream; each guard is proven by removing it once.
- [ ] The server docs list the new env variables.
