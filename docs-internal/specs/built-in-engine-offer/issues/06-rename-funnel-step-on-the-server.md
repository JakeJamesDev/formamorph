# 06: Rename Funnel Step on the Server

Status: ready-for-agent
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: one name changed in a list, its tests and one doc line.

**What to build:** the server's funnel step for the built-in engine story card is named `engine_offer_shown`, not `local_offer_shown` (Q16). Ticket 02 added the old name; no client build ever sent it, so the old name goes with no alias.

- [ ] `engine_offer_shown` is in the server's funnel step list and `local_offer_shown` is not.
- [ ] A post of `engine_offer_shown` is accepted and counted. A post of `local_offer_shown` is refused as an unknown step.
- [ ] The Usage report's offer rows include `engine_offer_shown`.
- [ ] The server docs that list the funnel steps are current.

For you: deploy the server before a client build that sends this step. A refused send is a lost count.
