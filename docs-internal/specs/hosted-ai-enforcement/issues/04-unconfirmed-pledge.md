# 04: Unconfirmed Pledge Stops Serving

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Entitlement freshness, Q3, Q5, Q6, Q25)

Model rationale: a clear rule with several readers and boundary tests.

**What to build:** a pledge Patreon has not confirmed for 7 days stops serving Formamorph AI. The proxy refuses with the new refusal code `pledge_unconfirmed`, and the Hosted state reports the new state `unconfirmed`. This ticket owns both names, and ticket 09 mirrors them. Flair and the Supporters wall do not change.

- [ ] A pledge just inside 7 days serves, and one just past it is refused with `pledge_unconfirmed`.
- [ ] A held tier with a null `checked_at` counts as unconfirmed.
- [ ] The Hosted state reports `unconfirmed` for that account.
- [ ] A live grant still serves that account, on the grant's own spend subject.
- [ ] Flair and the wall still show the tier.
- [ ] A successful read refreshes `checked_at`, and the next call is served.
- [ ] Removing the cutoff makes a test fail.
- [ ] The server glossary's Refusal code and Patreon reconcile entries, and the server guide, state the rule.
