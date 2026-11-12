# 01: Per-Source Funnel Steps on the Server

Status: done
Base: 8c99bde
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: a list change, its tests and one doc row.

**What to build:** the server accepts and counts a funnel step for every valid source and step pair (Q2, Q7), and still accepts the names v3.6.2 clients send (Q6). The Usage report's offer rows list every accepted step. Route, limiter and totals model stay as they are.

- [x] The step list holds exactly the valid pairs from the spec's "Sources and steps" decision plus `offer_shown`, `see_levels`, `patreon_click` and `checklist_finished`. `locked_see_levels` is valid (spec Q13). Invalid pairs such as `notice_offer_shown` and `locked_offer_shown` are absent. (Checked: `FUNNEL_STEPS` in `src/config/funnel.js` built from a per-source map; the 22 names are asserted in the Usage report test.)
- [x] A post of each new name is accepted and counted. A post of each legacy name is still accepted. An invalid pair is refused as an unknown step. (Tests: "accepts and counts every valid source and step pair", "still accepts the sourceless names", "refuses a pair the spec leaves out".)
- [x] The Usage report's offer rows include every name in the list. (Test: "sums the offer steps inside the range and lists every step".)
- [x] The server docs that list the funnel steps are current. (`README.md` route row; `docs-internal/server.md` lists no steps.)

## Landed

**Not verified:** none.

**For you:**
- Deploy the server before any client build that carries ticket 02. A refused send is a lost count.
