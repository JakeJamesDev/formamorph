# 11: Measure a Worst-Case Turn Against the Call Cap

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` (Turn call cap, Q15)

Model rationale: measurement with an existing harness and no product code.

**What to build:** a measured count of the calls a worst-case turn makes, so the user can set `turnCallCap` from evidence. The grace in ticket 01 follows that value.

- [x] Run with no paid spend, using the fake-reply harness. Extended copy of the fake probe; every request answered locally.
- [x] Report calls for a typical turn and for a worst-case turn with Staged thinking, full cast, diaries and discoveries. Rampage and Emberwatch, both concurrency modes, cast limit on and off, with a combined ceiling labeled as one.
- [x] Report tool rounds and schema fallback as separate multipliers. Forced tool calls on every Tools-offered request, and a 400 on `response_format`.
- [x] Report which passes a turn loses when the server refuses a call at the cap. Fake endpoint answered 409 `turn_expired` from call N on, six cut points, serial and parallel; passes reported as sets.
- [x] The numbers go in the local hosted-tier note and in chat, never in a tracked file.

For you: set the live `turnCallCap` in server settings from the reported numbers. This clears part of release blocker 07.

## Landed

The measurement is in the local hosted-tier note, section "Turn call cap measurement". No product code changed. The extended harness lives in the main checkout's `.scratch/nanogpt/fake-cap.cli.ts`.

**Not verified**
- The 409 cut ran on a plain endpoint, not the signed-in hosted route. Pass loss follows the runner and the transport, which treat any 409 alike, but the hosted turn message and preset state were not exercised.
- Whether the server counts a refused call toward the cap is unknown here.

**For you**
- Set the live `turnCallCap` from the note's per-turn, multiplier and ceiling figures. Where to look: the note's "Turn call cap measurement" section.
- The cap must clear every call before the narration, or a refusal there ends the turn with no story text. Where to look: the note's refusal list.
