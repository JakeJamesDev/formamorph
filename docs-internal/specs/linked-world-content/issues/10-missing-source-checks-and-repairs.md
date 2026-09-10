# 10: Missing-source checks and repairs

Status: ready-for-agent
Status note: PAUSED with the linked-world-content effort. Ticket 03 removes the `LINKING_ENABLED`
flag and is the resume point.
Blocked by: 06
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Model rationale: a Test Bench rule plus per-row repairs over settled outcomes; the gating of New Game and Publish needs care but the rules are explicit.

## Parent

[spec.md](../spec.md) — Missing sources and offline use, Settled follow-up decisions (Updates and repairs), ADR 0005 test bench shows computation.

## What to build

A world whose linked source cannot be reached tells the author what is known and offers a repair, without stopping play.

A Test Bench issues rule reports each world copy whose source check failed. A definite not-found answer reads as not found, with the author having removed it; any other failure reads as unavailable with **Retry Check**. Checks run only when the user asks. A missing required source blocks New Game and Publish for that world; editing and resuming existing saves continue. A missing optional source blocks nothing and keeps its association.

Each finding row carries its own repair: **Replace From Library** opens the searchable picker, **Unlink and Keep Content**, or **Remove From World**, applied with one **Apply** per row. A republished source has a new identity and never reconnects on its own; Replace From Library is the path. Applying a repair to a required source lifts the New Game and Publish gate. The rule lives in the embedded and docked bench placements and the mobile sheet like every other rule.

## Acceptance criteria

- [ ] With a source that answers not found, the issues list shows the not-found finding; with a network failure it shows unavailable with Retry Check.
- [ ] A missing required source disables New Game and Publish with the reason; resuming a save and editing work.
- [ ] A missing optional source shows a finding and blocks nothing.
- [ ] Replace From Library relinks the copy to the chosen library item; Unlink and Keep Content leaves an independent copy; Remove From World removes it; each applied per row.
- [ ] Repairing the required source re-enables New Game and Publish.
- [ ] Type check, lint, tests, and build pass; the rule test asserts the computed finding, never a judgment.

## Blocked by

- 06 — Download a world with dependencies and add-ons.
