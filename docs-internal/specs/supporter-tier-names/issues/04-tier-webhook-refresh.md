# 04: Tier Webhook Refresh

Status: wontfix
Status note: Ruled 2026-10-31 (spec Q5): Patreon has no tier trigger, so the hourly reconcile is the refresh path. Whether member deliveries carry tier titles stays unverified.
Base: 0b91798
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/supporter-tier-names/spec.md` in formamorph (Solution: Server)

Model rationale: one check of Patreon's webhook triggers, then at most one small handler change.

**What to build:** a tier rename in Patreon reaches the server through a webhook, as the spec's Solution says ("refreshes them on the hourly reconcile and on a tier webhook"). Today only `members:*` deliveries reach the handler. Such a delivery updates names only when it includes tier resources with a `title`, and nobody has checked whether Patreon sends them.

- [x] Find which Patreon v2 webhook triggers exist from Patreon's current webhook reference, and whether any one fires on a tier change. Read https://docs.patreon.com/#triggers-v2 on 2026-10-31: members:create/update/delete, members:pledge:create/update/delete, posts:publish/update/delete. None names a tier. A tier rename changes no member, so no member trigger covers it.
- [x] Check whether a `members:*` delivery includes tier resources with a `title`.
- [ ] If a trigger fires on a tier change, handle it and refresh the stored names. If none does, record that and keep the hourly reconcile as the only sure path.
- [ ] Tests cover the new path. Prove each guard by removing it once.

## Landed

No code changed. FormamorphServer stays at `0b91798`. No live Patreon call was made.

**Finding:** Patreon's v2 trigger list (https://docs.patreon.com/#triggers-v2, same list in https://docs.patreon.com/#webhook-changes) has no tier trigger. `members:pledge:update` fires on a member's upgrade or downgrade, not on a tier edit. The hourly reconcile stays the only sure path for a tier rename.

**Not verified:**
- Second criterion (does a `members:*` delivery include tier resources with a `title`): the docs sample shows empty `currently_entitled_tiers` and no tier in `included`, and the page does not say either way. No real delivery is stored to settle it: `patreonWebhookController.js` keeps no payload and logs none on success, and the stored tier names do not record their source. No ssh was needed. A one-off log of whether `included` has tier resources (no content) would answer it on the next real delivery.
- Third criterion, tests: no new path, so no tests.
- "Two sources": the docs page is the only official one. The second is the same page's migration section plus a web search that found no tier trigger (third-party pages only). No Patreon statement says "no tier trigger" in words.

**For you:** decide whether to accept the docs-only finding, or add a content-free log line in the webhook handler to learn whether deliveries carry tiers.
