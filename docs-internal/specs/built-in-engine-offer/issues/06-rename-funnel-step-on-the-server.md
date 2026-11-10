# 06: Rename Funnel Step on the Server

Status: ready-for-human
Base: a8e7d04
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: one name changed in a list, its tests and one doc line.

**What to build:** the server's funnel step for the built-in engine story card is named `engine_offer_shown`, not `local_offer_shown` (Q16). Ticket 02 added the old name; no client build ever sent it, so the old name goes with no alias.

- [x] `engine_offer_shown` is in the server's funnel step list and `local_offer_shown` is not. (`src/config/funnel.js`; no other `local_offer_shown` in the repo)
- [x] A post of `engine_offer_shown` is accepted and counted. A post of `local_offer_shown` is refused as an unknown step. (`funnelTotals.test.js`: "counts the built-in engine card step", "refuses the retired local_offer_shown name")
- [x] The Usage report's offer rows include `engine_offer_shown`. (`hostedAiUsageReport.test.js` offer rows test)
- [x] The server docs that list the funnel steps are current. (README funnel route row; "all four steps" fixed to five)

For you: deploy the server before a client build that sends this step. A refused send is a lost count.

## Landed

**Not verified:** none.

**For you:**
- Deploy the server before a client build that sends this step. A refused send is a lost count.
