# 02: Built-In Engine Card Funnel Step

Status: ready-for-agent
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: one name added to an existing list, with a route test.

**What to build:** the server accepts and counts a new funnel step, `local_offer_shown`, sent when the built-in engine story card shows. The Usage report then lists it beside `offer_shown`, so the two cards can be compared.

- [ ] `local_offer_shown` is in the server's funnel step list.
- [ ] A post of the new step is accepted and adds to its daily total.
- [ ] An unknown step is still refused. The test fails when the new step is removed from the list (run once without it, then restore).
- [ ] The Usage report's offer rows include the new step with its count.
- [ ] The server docs that list the funnel steps are current.

For you: deploy the server before a client build that sends this step. A refused send is a lost count.
