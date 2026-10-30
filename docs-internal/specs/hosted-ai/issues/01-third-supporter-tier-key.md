# 01: Third Supporter Tier Key

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai/spec.md` in formamorph (Tiers and entitlement)

Model rationale: a contained schema rebuild plus a key added to known surfaces; the risk is the SQLite table rebuild, which has prior art.

**What to build:** the server stores and honors a third Patreon tier above `supporter` and `supporter_plus`. A member on the new Patreon tier gets the tier key on link, webhook and reconcile, qualifies for Supporter content, and sorts first on the Supporters wall. Existing links and tiers are untouched. The Patreon tier id for the new key comes from the environment like the other two. The display name is open; use a working key name agreed with ticket 02 (the spec session settles it if asked).

- [ ] A schema step rebuilds `patreon_links` so its tier CHECK allows the new key, keeping every existing row and index.
- [ ] Link, webhook and reconcile map the new Patreon tier id to the new key.
- [ ] The new key qualifies for Supporter content; a test fails when it is removed from the qualifier.
- [ ] The Supporters wall sorts the new tier above Supporter+.
- [ ] Existing Patreon and Supporter content tests stay green unchanged.
- [ ] The server's env example and Patreon docs name the new tier id variable.
