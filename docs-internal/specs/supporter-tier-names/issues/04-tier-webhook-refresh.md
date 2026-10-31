# 04: Tier Webhook Refresh

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/supporter-tier-names/spec.md` in formamorph (Solution: Server)

Model rationale: one check of Patreon's webhook triggers, then at most one small handler change.

**What to build:** a tier rename in Patreon reaches the server through a webhook, as the spec's Solution says ("refreshes them on the hourly reconcile and on a tier webhook"). Today only `members:*` deliveries reach the handler. Such a delivery updates names only when it includes tier resources with a `title`, and nobody has checked whether Patreon sends them.

- [ ] Find which Patreon v2 webhook triggers exist from Patreon's current webhook reference, and whether any one fires on a tier change.
- [ ] Check whether a `members:*` delivery includes tier resources with a `title`.
- [ ] If a trigger fires on a tier change, handle it and refresh the stored names. If none does, record that and keep the hourly reconcile as the only sure path.
- [ ] Tests cover the new path. Prove each guard by removing it once.
