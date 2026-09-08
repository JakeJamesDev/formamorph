# 01: Retain one draft across Enter World

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

## Parent

[Enter World spec](../spec.md). This is the approved prefactoring slice; keep the existing screens usable while establishing a complete draft.

## What to build

Players can configure traits, location, entities, and dictionaries, revisit any existing step, and return from Avatar without losing choices. One entry draft owns these choices and dictionary order throughout the current flow. Introduction and placeholder resolution use that same draft.

Model rationale: state ownership crosses entry sequencing, asynchronous content resolution, placeholder lifetime, and Avatar handoff; use greater reasoning depth to preserve their contracts.

## Acceptance criteria

- [x] Own trait IDs, starting-location choice, entity references, dictionary enabled states/order, and useful navigation state above individual picker rendering. Revisiting or remounting a picker restores the draft rather than reseeding defaults.
- [x] Existing screens remain functional end to end; no UI redesign or persistent personal defaults are required in this ticket.
- [x] Seed a new draft from authored trait defaults, Random location behavior, disabled library additions, and authored world-dictionary defaults. Preserve source-qualified dictionary identities and ordering.
- [x] Begin the Placeholder Session before Introduction/setup resolution. Navigation and Avatar return preserve Rolls and live trait/location/starting-stat Pins; deselection restores the underlying Roll.
- [x] Introduction remains the existing markdown overlay with shared visibility preferences. Quick Start, save loading, and gameplay readme behavior are unchanged.
- [x] Cancel discards the draft and ends its session. Re-entry starts fresh. Avatar return preserves the draft; Avatar customization itself is unchanged.
- [x] Final game-start payload reflects the draft, including an explicitly empty dictionary list rather than authored fallback. Preserve existing independent library-copy behavior and prevent duplicate starts during resolution.

## Verification

- Extend the existing real MainMenu harness to configure, navigate backward/forward, and assert retained controls and final start payload. Cover Avatar return and cancel/re-entry.
- Use existing Placeholder Session, readme, entry-sequencing, starting-location, and dictionary-finalization tests where they prove the contract. Do not mock the draft orchestration or introduce a broad engine seam.
- Prove retention and session-lifetime guards fail when their behavior is reverted. Run relevant type/lint/test gates once per check, report test wall time, and investigate lingering handles. Do not weaken scenarios to get green results.

## Scope boundary

No production layout replacement, per-world persistence, Avatar redesign, export changes, or release/version edits. Any extraction stays narrowly tied to retained entry behavior.

## Comments

### Implementation verification

- One MainMenu draft retains traits, location, entity references, dictionary toggles/order, and trait-section navigation. Library resolution uses a guarded draft snapshot; cancel invalidates pending work and ends the Placeholder Session.
- Seven real MainMenu tests cover retained controls and start payloads, Avatar return, explicit empty dictionaries, cancel/re-entry, Introduction-only worlds, Quick Start, Rolls, live Pins, and delayed/duplicate starts.
- Four deliberate regressions failed their intended tests: lost entity selection, retained canceled session, stale completion after cancellation, and duplicate resolution. Each source restoration was checked byte-for-byte.
- Focused coverage: 90 tests passed in 22.0 seconds; draft 100% lines, pickers 94–100%, MainMenu 63.8% overall (includes unrelated library/account flows). The expanded seven-case entry run passed in 15.6 seconds.
- Final gates: typecheck 0, lint 0, 8,481 tests passed / 3 skipped in 61.1 seconds (exit 0), build succeeded. Graph updated. Standards and Spec reviews found no actionable issues.
- Live Chromium verification at 1365×900 and 390×844 confirmed retained controls, pointer and keyboard dictionary ordering, cancel/reset, and a reachable Start button, with no page errors. The dev route is `mainMenu` with `modal=enterWorld` and the stored world ID in `tab`.
- Export shapes and version are unchanged. No persistent personal defaults or layout redesign are included.