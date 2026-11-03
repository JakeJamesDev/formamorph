# 03: Level Prices

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/first-time-flow/spec.md` in formamorph (Scene)

Model rationale: one more field on an existing refresh and route, with a live check of Patreon's field.

**What to build:** the server knows each level's price from Patreon, so a price change in Patreon needs no build. The public tier-names reply gains the price beside each title, without breaking a client that reads only the titles.

- [ ] Confirm the price field on Patreon's Tier resource against Patreon's current docs and one live campaign read. Report the field name in the ticket.
- [ ] The hourly reconcile stores each tier's price with its title. A failed refresh keeps the last prices.
- [ ] The public route returns the stored prices, `null` for an unknown tier, and makes no Patreon call on a request.
- [ ] A client that reads the existing title shape keeps working. A test holds that shape.
- [ ] The server's docs for the route are current.
