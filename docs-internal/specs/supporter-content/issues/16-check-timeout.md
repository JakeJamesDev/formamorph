# 16: Client: Supporter content requests time out

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: adds a timeout to two requests in a module with injected fetch and clock.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Found by the close review.

## What to build

The Supporter content module's entitlement check and install fetch have no timeout or abort. A stalled request never counts as a failed check: status stays checking, listings show **Checking…** forever, later installs queue behind it, and a lapsed account never falls back to Morphie (Q3, Q6). A stalled request must end as a failed check, or a failed install, after a bounded time.

## Acceptance criteria

- [ ] A check that gets no answer within the time limit counts as a failed check and follows the 7-day rule.
- [ ] An install that gets no answer within the time limit fails, and the next install runs.
- [ ] The request is aborted when it times out, and no timer outlives it.
- [ ] Tests drive both cases with the injected fetch and clock.
