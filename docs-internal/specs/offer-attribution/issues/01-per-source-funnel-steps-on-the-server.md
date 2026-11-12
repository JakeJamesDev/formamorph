# 01: Per-Source Funnel Steps on the Server

Status: ready-for-agent
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: a list change, its tests and one doc row.

**What to build:** the server accepts and counts a funnel step for every valid source and step pair (Q2, Q7), and still accepts the names v3.6.2 clients send (Q6). The Usage report's offer rows list every accepted step. Route, limiter and totals model stay as they are.

- [ ] The step list holds exactly the valid pairs from the spec's "Sources and steps" decision plus `offer_shown`, `see_levels`, `patreon_click` and `checklist_finished`. Invalid pairs such as `locked_see_levels` and `notice_offer_shown` are absent.
- [ ] A post of each new name is accepted and counted. A post of each legacy name is still accepted. An invalid pair is refused as an unknown step.
- [ ] The Usage report's offer rows include every name in the list.
- [ ] The server docs that list the funnel steps are current.

For you: deploy the server before any client build that carries ticket 02. A refused send is a lost count.
