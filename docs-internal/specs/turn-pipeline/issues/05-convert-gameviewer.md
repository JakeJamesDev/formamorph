# 05 — Convert GameViewer To The Turn Pipeline

**What to build:** The payoff: the view's turn handler shrinks to building the planner inputs, calling the pipeline with the real request adapter, rendering forwarded narration events, mapping error kinds to the existing toasts, and applying the Turn Commit with thin setters. The old 882-line body — both dispatch paths, the inline error taxonomy, the interleaved commit — is deleted. Player-visible behavior is unchanged.

**Blocked by:** 03 — The Runner; 04 — Compute The Turn Commit.

Status: done
Status note: all acceptance checks met.

- [x] The old turn function's body is gone; no dead second dispatch path remains
- [x] Toast text and recovery guidance per error kind match today's byte-for-byte
- [x] Narration reveal/TTS/scene-list presentation unchanged (view consumes forwarded events)
- [x] A live baseline Sedge Landing run through the converted app matches the parity fixture's request sequence — recaptured 2026-08-13 on the fixture's own model (`gemma4-e4b-cloud`) into `testing/baseline/runs/parity-converted.json`. All 7 turns emit the recorded pass order; every request type carries the recorded cap / silent / attached-turn envelope; 7 milestone drainers and 0 orphans in both. The only difference is fan-out width — the director cast one NPC per turn where the recorded run cast two — and the invariant `character passes == director NPC bullets` holds in **both** runs, so that tracks the model's answer, not the dispatch. The one turn that wrote no diary named nobody in its narration.
- [x] Turn stop, connection failure, and the opening turn verified in the real app — driven through the dev server against a mock OpenAI-compatible endpoint. Opening turn dispatched `director → character → storyboard → narration → [choices, statUpdates, summary, timePassed, openingTime, diary]` in plan order; a mid-stream stop kept the partial narration with history strictly paired and no toast; a dead endpoint produced the single "Couldn't reach your AI server" guide toast, the same log line, and an unchanged history.
- [x] Changelog In-Progress entry appended (⚙️ bucket) — folded into the existing Turn Pipeline entry rather than appended, since none of the staged work has shipped.
- [x] Four gates green; graphify updated

**Follow-up (out of scope here):** `requestChoices`/`requestStats` in the view now duplicate the request assembly the choices/statUpdates pass records own — the re-roll path should build from the pass records instead.
