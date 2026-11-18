# 01: Server: Tier schedule for Supporter-only listings

Status: ready-for-agent
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

- [ ] A tier ranking function built on the existing tier list ranks every tier key. No route hardcodes a tier name.
- [ ] During a Beacon-only stage, with an injected clock, the gated route serves a top-tier account and refuses the two lower tiers. The refusal names the open tier and its date.
- [ ] Each stage opens at its date with no sweep run. A tier with no row opens with the next tier down.
- [ ] A live listing with only `supporter_until` and no schedule rows behaves exactly as before.
- [ ] The listing goes public at the public date. Choosing no public date keeps the last stage open with no end.
- [ ] Create and the Supporter-only route accept a schedule. They refuse an out-of-order schedule, any kind except Mascot and World, a non-admin, and a public date in the past. Each change writes an audit entry.
- [ ] Moving a passed stage back into the future works until the listing goes public (Q8).
- [ ] Catalog and details carry the schedule only while the listing is Supporter-only.
- [ ] Staff and the listing's author pass at every stage.
- [ ] The entitlement reply carries the account's tier key. A lower-tier qualifying account gets the same lists as a top-tier one.
- [ ] The server's docs on the Supporter-only routes describe the schedule fields.
