# 01: Tier Names from Patreon

Status: ready-for-human
Base: 4143700
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/supporter-tier-names/spec.md` in formamorph (Q1, Q2, Solution: Server)

Model rationale: one stored lookup, refreshed by jobs that already run, behind one public route.

**What to build:** the server keeps each tier's Patreon title by tier key and serves it on a public route, so the app and site never hardcode tier names.

- [x] Verify against the live API which call returns tier titles: the campaign call with `include=tiers&fields[tier]=title` first, the members call with `fields[tier]=title` as the fallback. Record the result in the ticket. Result: the campaign call answered 200 with all three tiers carrying a title, so it is the primary path. The members call was not needed. A failed or title-less campaign call falls back to the members call, and a fallback answer only renames the tiers it lists.
- [x] The hourly reconcile and a tier webhook refresh the stored names. A failed Patreon call keeps the old names. `keeps the old names when Patreon fails`, `renames only the tiers it carries`
- [x] A public route returns `{ supporter, supporter_plus, supporter_top }`, each a string or `null`, with no Patreon call on the request. `serves the stored titles by tier key`, `makes no Patreon call on a request`
- [x] The README lists the route. `GET /api/patreon/tier-names` under "Patreon"
- [x] Tests cover a stored list, an unknown tier, a failed refresh, and no Patreon call on a request. Prove each guard by removing it once. `tests/patreonTierNames.test.js`; eight guards re-broken, each turned the named test red, source restored

## Landed

**Not verified**

- None. The live check used one read-only campaign GET; no title or token is recorded here.

**For you**

- Set the three tier titles in Patreon (release blocker 04), then confirm `GET /api/patreon/tier-names` returns them after the next hourly reconcile.
- The webhook renames tiers only when a delivery carries tier resources. The server handles only member triggers, so the hourly reconcile is the sure path.
