# 01: Server: Tier schedule for Supporter-only listings

Status: ready-for-human
Base: 3ae1dab
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: a child table, one ranking function and one gate helper threaded through existing routes, plus validation on two admin routes. Many call sites, little novelty.

## Parent

[spec.md](../spec.md) — Supporter Tier Schedule.

## What to build

An admin can give a Supporter-only Mascot or World listing a tier schedule when they create it or later through the Supporter-only route. The schedule is days per stage, highest tier first, with a choice to go public after the last stage (Q3, Q4, Q9). The server stores each lower tier's opening date in a new child table keyed by tier key, and keeps `supporter_until` as the public date (Q5). Every download route admits an account only when its tier ranks at or above the tier open now. Staff and the listing's author pass as today. A refused download names the tier and the date it opens (Q6). Catalog and details carry the schedule while the listing is Supporter-only (Q2). The entitlement reply adds the account's tier key beside `qualifies`, and its lists stay unfiltered by tier (Q1).

## Acceptance criteria

- [x] A tier ranking function built on the existing tier list ranks every tier key. No route hardcodes a tier name. (`tier ranking` test; `tierRank` over `TIER_KEYS`)
- [x] During a Beacon-only stage, with an injected clock, the gated route serves a top-tier account and refuses the two lower tiers. The refusal names the open tier and its date. (`a stage open to the top tier only`)
- [x] Each stage opens at its date with no sweep run. A skipped stage's row carries the date the next stage opens, and a null row is the public date, or never. (`each stage opens by the clock alone`, `no public date`)
- [x] A live listing with only `supporter_until` and no schedule rows behaves exactly as before. (`a listing with no schedule rows`; the old end-date suite passes unchanged)
- [x] The listing goes public at the public date. Choosing no public date keeps the last stage open with no end. (`goes public at the public date`, `no public date`)
- [x] Create and the Supporter-only route accept a schedule. They refuse an out-of-order schedule, any kind except Mascot and World, a non-admin, and a public date in the past. Each change writes an audit entry. (`creating a schedule`, `editing a schedule`)
- [x] Moving a passed stage back into the future works until the listing goes public (Q8). (`moves a passed stage back into the future`)
- [x] Catalog and details carry the schedule only while the listing is Supporter-only. (`the schedule in the payloads`)
- [ ] Staff and the listing's author pass at every stage. Staff verified (`staff and the listing author`, both admins). A non-staff author is not: only an admin can publish Supporter-only.
- [x] The entitlement reply carries the account's tier key. A lower-tier qualifying account gets the same lists as a top-tier one. (`the entitlement reply`)
- [x] The server's docs on the Supporter-only routes describe the schedule fields. (`docs-internal/server.md`, Tier schedule)

## Landed

**Not verified**

- Staff and the listing's author pass at every stage: a non-staff author has no way to publish Supporter-only, so only staff passes were tested.

**For you**

- A refused download reads "This listing is open to supporter_top Supporters now and opens to your tier on <date>". It shows raw tier keys, since the server has no display names. Clients should use `requiredTier` and `opensAt`.
- `supporterSchedule: null` on an existing listing clears the rows and keeps `supporter_until`, so the listing opens to every tier at once (the no-rows rule).
- Rows stay after the listing goes public or a staff clear. A new Supporter-only window replaces them.
