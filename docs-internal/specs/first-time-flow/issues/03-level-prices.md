# 03: Level Prices

Status: done
Base: e17fb97
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/first-time-flow/spec.md` in formamorph (Scene)

Model rationale: one more field on an existing refresh and route, with a live check of Patreon's field.

**What to build:** the server knows each level's price from Patreon, so a price change in Patreon needs no build. The public tier-names reply gains the price beside each title, without breaking a client that reads only the titles.

- [ ] Confirm the price field on Patreon's Tier resource against Patreon's current docs and one live campaign read. Report the field name in the ticket. Field is `amount_cents` (integer, US cents), confirmed in docs.patreon.com; live read not done (see Landed).
- [x] The hourly reconcile stores each tier's price with its title. A failed refresh keeps the last prices. `patreonTierNames.test.js`: "keep the old prices when Patreon fails", "serve the stored cents beside the titles".
- [x] The public route returns the stored prices, `null` for an unknown tier, and makes no Patreon call on a request. "are null before any price is known", "are made without a Patreon call on a request".
- [x] A client that reads the existing title shape keeps working. A test holds that shape. "keep the title keys as plain strings for a client that reads only titles"; the older title tests read only the title keys.
- [x] The server's docs for the route are current. `README.md` route line and `CONTEXT.md` Tier name entry.

## Landed

**Not verified**
- Live campaign read of `amount_cents`: the production read was denied by the permission rule. Field name comes from Patreon's docs only. The campaign currency (spec Q35: USD) is also unchecked; the docs list a Campaign `currency` attribute.

**For you**
- Run one read of the campaign with `include=tiers&fields[tier]=title,amount_cents` and confirm the three prices and a USD currency before the client ships.
- Deploy the server before the client reads `prices`; the new setting key `patreon_tier_prices` fills on the first hourly reconcile after deploy.
