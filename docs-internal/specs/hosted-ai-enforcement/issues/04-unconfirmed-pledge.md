# 04: Unconfirmed Pledge Stops Serving

Status: ready-for-human
Base: 6a1f462
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Entitlement freshness, Q3, Q5, Q6, Q25)

Model rationale: a clear rule with several readers and boundary tests.

**What to build:** a pledge Patreon has not confirmed for 7 days stops serving Formamorph AI. The proxy refuses with the new refusal code `pledge_unconfirmed`, and the Hosted state reports the new state `unconfirmed`. This ticket owns both names, and ticket 09 mirrors them. Flair and the Supporters wall do not change.

- [x] A pledge just inside 7 days serves, and one just past it is refused with `pledge_unconfirmed`. (hostedAiState.test.js "serves just inside 7 days…", plus an exact-7-days `entitlement` test)
- [x] A held tier with a null `checked_at` counts as unconfirmed. ("counts a held tier with a null or unreadable checked_at…")
- [x] The Hosted state reports `unconfirmed` for that account. ("reports the unconfirmed state…")
- [x] A live grant still serves that account, on the grant's own spend subject. ("still serves on a live grant…")
- [x] Flair and the wall still show the tier. ("leaves flair and the Supporters wall…", model level)
- [x] A successful read refreshes `checked_at`, and the next call is served. ("resumes on the next call…", via `PatreonLink.setTier`)
- [x] Removing the cutoff makes a test fail. (4 tests red with the cutoff removed; the exact-7-days test red with `<=` turned to `<`)
- [x] The server glossary's Refusal code and Patreon reconcile entries, and the server guide, state the rule. (`CONTEXT.md`, `docs-internal/server.md`)

## Landed

**Not verified**
- The resume test sets `checked_at` through `PatreonLink.setTier`. It does not drive the reconcile job or the webhook.

**For you**
- A future-dated `checked_at` counts as confirmed (clock skew). The spec does not cover it.
- A webhook delivery stamps `checked_at` without a read of the member list, so a stale or replayed delivery can refresh the cutoff until the spec's webhook item lands.
- Supporter-only content still reads the raw tier and ignores `checked_at`, as the spec limits the cutoff to Formamorph AI.
