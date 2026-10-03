# 02: Shared prompt option fields

Status: done
Base: 4e55abce
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A prefactor with no behavior change. The fields of Settings → Prompts → Options become shared components, so Formaquestion Settings (tickets 09 and 13) can use them:

- **The reasoning field:** the effort control and the budget slider.
- **The sampler fields.** Ticket 01 already moved the sampler control out of the Settings modal as a shared, exported component, because the endpoint editor uses it. Reuse it; do not move it again.
- **The Max Output field.**

The code that builds the reasoning field's props from a resolved endpoint (the effort list, the budget, the locked and refused states) becomes one function that takes the resolved endpoint and a reasoning setting. The Settings modal calls it for a prompt; Formaquestion will call it for the answer endpoint.

This ticket does not touch the help session, so it can start before Formaquestion ticket 46 reports.

Recommended model rationale: a small extraction, but the reasoning states (ruled out, awaiting proof, locked on) are easy to drop.

## Acceptance criteria

- [x] The fields are exported and take props only.
- [x] One function builds the reasoning field's props from a resolved endpoint and a setting, with a pure test for each state: no reasoning support, levels, budget, locked on, off refused.
- [x] Settings → Prompts → Options looks and works as before, and the existing tests pass with no edit to an assertion.
- [x] The four gates are green.
