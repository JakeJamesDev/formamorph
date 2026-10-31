# 01: Tier Names from Patreon

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/supporter-tier-names/spec.md` in formamorph (Q1, Q2, Solution: Server)

Model rationale: one stored lookup, refreshed by jobs that already run, behind one public route.

**What to build:** the server keeps each tier's Patreon title by tier key and serves it on a public route, so the app and site never hardcode tier names.

- [ ] Verify against the live API which call returns tier titles: the campaign call with `include=tiers&fields[tier]=title` first, the members call with `fields[tier]=title` as the fallback. Record the result in the ticket.
- [ ] The hourly reconcile and a tier webhook refresh the stored names. A failed Patreon call keeps the old names.
- [ ] A public route returns `{ supporter, supporter_plus, supporter_top }`, each a string or `null`, with no Patreon call on the request.
- [ ] The README lists the route.
- [ ] Tests cover a stored list, an unknown tier, a failed refresh, and no Patreon call on a request. Prove each guard by removing it once.
