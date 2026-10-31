# 02: App and Site Read Tier Names

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one module replaces a constant map at about ten call sites in the app and site.

**What to build:** one module owns tier names. It reads ticket 01's route once per session, caches the last answer locally, and returns **Member** for a tier with no known name. Every tier name in the app and site comes from it. `SUPPORTER_LABELS` in `src/lib/supporterFlair.ts` goes.

Call sites today: `SupporterBadge`, `PatreonSection`, `HostedPresetStatus`, `HostedAiPanel`, the design-system Supporter flair reference, and the site's `SupportersPage` and `AllowanceSection`.

- [x] Every call site reads the module; no copy of the old labels remains in the app or site. (grep for `SUPPORTER_LABELS`; typecheck)
- [x] Offline or before the first answer, the cached name shows; with no cache, **Member** shows. (`tierNames.test.tsx`: cached name offline, Member with no cache)
- [x] The site bundle boundary allows the module. (`bundleBoundary.test.ts`: allow list, stylesheet scan, ceilings 72 and 102)
- [x] Tests cover the server name, the cached name, and the **Member** fallback. Prove each guard by removing it once. (fallback, cache read and cache write each removed once; the matching tests went red)

## Landed

**Not verified**
- The live route: the hand-off did not call the deployed server. Tests stub `fetch`.
- The merge rule (a tier the server cannot name keeps its cached name) is my addition from review. The spec says "caches the last answer".

**For you**
- Open the Supporters page and the account page after the server deploy: tier names read as the Patreon titles.
- Until the deploy, every tier shows **Member**.
