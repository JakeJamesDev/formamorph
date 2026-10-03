# 01: Shared text-endpoint editor

Status: done
Base: 8bbbfaa2
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A prefactor with no behavior change. Three parts of the Settings modal become shared components, so the Formaquestion Settings modal (ticket 07) can use them:

- **The text-endpoint editor** of AI Endpoints → Text: the preset select, the fields, and add, rename, delete and reset.
- **The endpoint select with Follow Active**, which Prompts → Options uses for per-prompt routing.
- **The reachability badge** for one named endpoint.

Each component takes its data and its handlers as props. None reads the active prompt tab. The Settings modal passes the same values it uses today.

This ticket does not touch the help session, so it can start before Formaquestion ticket 46 reports.

Recommended model rationale: a mechanical extraction from a very large modal, where a missed prop changes behavior with no type error.

## Acceptance criteria

- [ ] The three components are exported and take props only; none imports from the Settings modal.
- [ ] The Settings modal renders them, and its AI Endpoints → Text tab and Prompts → Options look and work as before.
- [ ] The existing Settings modal tests pass with no edit to an assertion.
- [ ] Each component has a thin test of its own: select a preset, pick Follow Active, show each reachability state.
- [ ] The four gates are green.
