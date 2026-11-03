# 11: Measure a Worst-Case Turn Against the Call Cap

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` (Turn call cap, Q15)

Model rationale: measurement with an existing harness and no product code.

**What to build:** a measured count of the calls a worst-case turn makes, so the user can set `turnCallCap` from evidence. The grace in ticket 01 follows that value.

- [ ] Run with no paid spend, using the fake-reply harness.
- [ ] Report calls for a typical turn and for a worst-case turn with Staged thinking, full cast, diaries and discoveries.
- [ ] Report tool rounds and schema fallback as separate multipliers.
- [ ] Report which passes a turn loses when the server refuses a call at the cap.
- [ ] The numbers go in the local hosted-tier note and in chat, never in a tracked file.

For you: set the live `turnCallCap` in server settings from the reported numbers. This clears part of release blocker 07.
