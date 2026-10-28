# 09: Server: Supporter-only listings, gated route and revocation

Status: done
Base: 021e9a3
Repo: FormamorphServer
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: several routes with a tier and revocation matrix, in an established route-test style.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings.

## What to build

Staff can mark any listing Supporter-only (Q13). Its content moves to the private Supporter area. The public content route refuses it. A gated content route serves it only to a signed-in account whose live tier is Supporter or Supporter+ and whose Supporter content access is not revoked (Q2, Q10). Listing details, thumbnail, likes and comments stay public (Q19). The gated route runs content through a per-account processing hook that passes content through unchanged for now (ticket 10 fills it).

Staff can revoke and restore one account's Supporter content access; Supporter Flair and the Supporters wall don't change. A signed-in entitlement route returns whether the account qualifies and every Supporter-only listing it may install, with id, kind and current revision (Q6, Q22).

## Acceptance criteria

- [x] Only staff can set or clear Supporter-only; payloads carry the flag. (`marking a listing Supporter-only` tests)
- [x] The public content route returns 403 for a Supporter-only listing. (`the public content route`, direct and as a dependency)
- [x] The gated route serves a Supporter and a Supporter+ account, and refuses a signed-out caller, a non-supporter, a lapsed account and a revoked account. (`the gated content route`; it also serves the author and staff, per the spec session)
- [x] Revoke and restore are staff-only and don't change Supporter Flair. (`revoking Supporter content access`)
- [x] The entitlement route returns the qualifying state and each item's revision; a revision bump shows in the next read. (`the entitlement route`)
- [x] Route tests cover each case above. (`tests/supporterOnly.test.js`, 39 tests; guards proven by breaking them)

## Landed

**Not verified**

- The review route (`GET /api/reviews/:id/content`) runs a flagged listing's content through the processing hook, but the hook is a pass-through now, so no test can tell. Ticket 10 should cover it.

**For you**

- A world can still declare a Supporter-only listing as a required dependency. The dependency content route answers 403 for it. The spec session got this question and may reply with a change.
- The gated route counts a download for the author and staff too.
- Revoking does not block the listing's author or staff, who are never revoked (staff cannot revoke each other).
