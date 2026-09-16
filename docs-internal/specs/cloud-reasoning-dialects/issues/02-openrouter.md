# 02: OpenRouter

Status: ready-for-human
Status note: Built and committed as 22ddc06b. Four gates green, 10,397 tests in 76.6s. Reviewed on both axes; the one real finding is folded in. Also closes both items ticket 01 handed over.
Base: 685b4152
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Cloud Reasoning Dialects](../spec.md)

**What to build:** A player on OpenRouter gets controls that match the chosen model. The models list names the dialect, the supported efforts, whether a token budget is taken, and whether reasoning is mandatory. The slider shows where the model takes a budget, the dropdown lists the model's efforts, the switch locks on a mandatory model, and each request carries `reasoning.max_tokens` or `reasoning.effort` as OpenRouter documents.

**Rationale for the model:** one advertisement source already read by the resolver, extended with three more fields, plus a dialect row. Sonnet at medium effort.

## Acceptance criteria

- [x] The gateway source in the resolver marks the openrouter dialect when the models list entry carries a `reasoning` object, and fills levels from `supported_efforts`, budget from `supports_max_tokens`, and off-allowed from `mandatory`.
- [x] An entry with `supported_efforts` null lists every gateway effort; an entry with it omitted sends no effort and hides the dropdown.
- [x] The openrouter dialect spells the budget as `reasoning.max_tokens`, the effort as `reasoning.effort`, and off as `reasoning.effort: none` only where off is allowed. Both budget and effort may go out together, as the docs allow.
- [x] A mandatory model renders the switches checked and disabled and sends no off field.
- [x] Request-spec tests cover budget only, effort only, both, off, and mandatory-off. Resolver tests use a fixed OpenRouter models entry per case.
- [x] Live check with the user's OpenRouter key if one exists, against one model with `supports_max_tokens` true, recording the reasoning token count at two budgets in the changelog entry. Without a key, the entry says tested against docs only.
- [x] Typecheck, lint, tests, and build pass; report test wall time; prove the mandatory guard fails when the off field is sent regardless. Update the code graph. Changelog In Progress entry, 👤 bucket, under the Native Reasoning group.

## Scope notes

OpenRouter only. Its `reasoning.exclude` and `include_reasoning` are not sent.

## Comments

**2026-09-15 — built, reviewed, handed over.**

Every acceptance criterion is met. The resolver's `reasoning`-object branch became `openRouterCapability`, which answers four questions from one entry: the dialect by the object's existence, the strengths from `supported_efforts`, the budget from `supports_max_tokens`, and off-allowed from `mandatory`.

**Both of ticket 01's handed-over items are closed**, on the spec session's ruling that they belong here.

- Off-allowed is a record answer now, not a dialect property, since one gateway serves models that differ on it. `reasoningOffRefused` reads the record first and the dialect row second, so `google-3` and `moonshot-k3` keep their behavior through the same line and tickets 03 and 04 need no code for it.
- A switched-off prompt on an endpoint that refuses off carries the strength its locked switch reads, resolved by `resolveRequestReasoning` from the stored settings the snapshot hands in as `keptReasoning`. Both switches are ignored there, because both render locked. Inline narration still resolves to `none`.

**Three states, not two.** `supported_efforts` as a list names the literals; `null` accepts every gateway effort; omitted means the model exposes no strength, which is an empty level list rather than an unanswered question. That made an empty list ambiguous, so `reasoningRuledOut` now rules a model out on an empty list only when `reasons` is not `true`. Nothing today pairs `reasons: true` with an empty list, so every existing record reads as before. A list that arrives with entries and ends up empty stays unanswered instead, whether the mandatory filter took its only literal or it named nothing the app knows.

**Evidence.** Field meanings come from OpenRouter's reasoning-tokens guide and its live models list, read 2026-09-15. Of 446 models, 314 carry the object and ten advertise a token budget. No live request was made: there is no OpenRouter account, so the changelog entry says tested against docs only, per this ticket's own criterion.

**Gates.** typecheck 0 errors, lint 0 errors, build 16.00s, suite 10,397 passing in 76.6s wall. Every failure in that run sits in another session's untracked `reasoningIdentity` files, none of them in this commit. `graphify update .` ran on commit.

**Red-proofs.** Stripping the record's off-allowed answer out of `reasoningOffRefused` turns five tests red, including the locked switch, both mandatory request cases and two resolve cases. Dropping the unanswered-levels rule turns two red, the unknown-literals case and the existing mandatory-only-`none` case.

**Review findings not applied, with reasons.**

- The Output tab still draws its strength dropdown where the active model names no strength. The spec session ruled it stays: that row is the endpoint-wide strength every Global prompt follows, including prompts pinned to other endpoints whose records do list levels. The hide belongs on the prompt row, which belongs to one target.
- `reasoningOffRefused` and `reasoningDialect`'s `reasoningOffRejected` are synonyms, and `reasoningLevelControl` is a noun phrase beside verb-phrase siblings. Renaming exported symbols while tickets 03 and 05 hold those files would have cost a park cycle each; worth a later cleanup.
- Eleven `offAllowed: null` literals in the resolver would read better as spreads of `UNKNOWN_REASONING_CAPABILITY`, which is how the new tests build records. Same reason: it rewrites lines two other sessions are editing.

**One changelog line in this commit is not this ticket's.** Ticket 05's vLLM entry was swept in, since the changelog is the shared file and the protocol says to leave a neighbor that rides along. Its code follows in 05's own commit.
