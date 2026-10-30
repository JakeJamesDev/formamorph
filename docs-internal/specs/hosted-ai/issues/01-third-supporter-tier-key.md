# 01: Third Supporter Tier Key

Status: ready-for-human
Base: 10e9a24
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai/spec.md` in formamorph (Tiers and entitlement)

Model rationale: a contained schema rebuild plus a key added to known surfaces; the risk is the SQLite table rebuild, which has prior art.

**What to build:** the server stores and honors a third Patreon tier above `supporter` and `supporter_plus`. A member on the new Patreon tier gets the tier key on link, webhook and reconcile, qualifies for Supporter content, and sorts first on the Supporters wall. Existing links and tiers are untouched. The Patreon tier id for the new key comes from the environment like the other two. The display name is open; use a working key name agreed with ticket 02 (the spec session settles it if asked).

- [x] A schema step rebuilds `patreon_links` so its tier CHECK allows the new key, keeping every existing row and index. (`supporterTop` step; tests/supporterTop.test.js "migrating a two-tier database"; the table has no named index)
- [x] Link, webhook and reconcile map the new Patreon tier id to the new key. (`tierStateOf` test, plus a webhook delivery and a reconcile test; the link flow shares `tierStateOf`, not run on its own)
- [x] The new key qualifies for Supporter content; a test fails when it is removed from the qualifier. (removed it: two tests went red, then restored)
- [x] The Supporters wall sorts the new tier above Supporter+. ("lists the top tier above Supporter+ and Supporter")
- [x] Existing Patreon and Supporter content tests stay green unchanged. (full `npm test` green, 53 s)
- [x] The server's env example and Patreon docs name the new tier id variable. (`PATREON_SUPPORTER_TOP_TIER_ID` in README.md; the repo has no env example file)

## Landed

**Not verified**
- None of the criteria is left unticked.
- Link flow has no test of its own with `tier-top`. It calls the same `tierStateOf` as the two flows that do.

**For you**
- `tests/supporterProcessing.test.js`: the "carries the seed, format version and original size" test timed out at the default 5 s on the clean base too. I added a 120000 ms timeout, no assertion change, as approved. A separate session finds why it is slow.
- Set `PATREON_SUPPORTER_TOP_TIER_ID` in the server `.env` by hand before the tier goes live.
