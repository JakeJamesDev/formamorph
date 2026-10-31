# 02: App and Site Read Tier Names

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one module replaces a constant map at about ten call sites in the app and site.

**What to build:** one module owns tier names. It reads ticket 01's route once per session, caches the last answer locally, and returns **Member** for a tier with no known name. Every tier name in the app and site comes from it. `SUPPORTER_LABELS` in `src/lib/supporterFlair.ts` goes.

Call sites today: `SupporterBadge`, `PatreonSection`, `HostedPresetStatus`, `HostedAiPanel`, the design-system Supporter flair reference, and the site's `SupportersPage` and `AllowanceSection`.

- [ ] Every call site reads the module; no copy of the old labels remains in the app or site.
- [ ] Offline or before the first answer, the cached name shows; with no cache, **Member** shows.
- [ ] The site bundle boundary allows the module.
- [ ] Tests cover the server name, the cached name, and the **Member** fallback. Prove each guard by removing it once.
