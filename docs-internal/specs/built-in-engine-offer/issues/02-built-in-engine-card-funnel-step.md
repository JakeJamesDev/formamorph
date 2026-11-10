# 02: Built-In Engine Card Funnel Step

Status: ready-for-human
Base: a202ce5
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: one name added to an existing list, with a route test.

**What to build:** the server accepts and counts a new funnel step, `local_offer_shown`, sent when the built-in engine story card shows. The Usage report then lists it beside `offer_shown`, so the two cards can be compared.

- [x] `local_offer_shown` is in the server's funnel step list. (`src/config/funnel.js`)
- [x] A post of the new step is accepted and adds to its daily total. (`counts the built-in engine card step`: 204, row count 1)
- [x] An unknown step is still refused. The test fails when the new step is removed from the list (run once without it, then restore). (`refuses an unknown step` still passes; without the step, 4 tests failed, restored: 26 pass)
- [x] The Usage report's offer rows include the new step with its count. (`sums the offer steps inside the range and lists every step`)
- [x] The server docs that list the funnel steps are current. (`README.md` route table; `docs-internal/server.md` lists no steps)

For you: deploy the server before a client build that sends this step. A refused send is a lost count.

## Landed

**Not verified**
- None.

**For you**
- Deploy the server before a client build that sends this step. A refused send is a lost count.
