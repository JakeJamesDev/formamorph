# 07: Formamorph AI Preset Tracer

Status: ready-for-agent
Blocked by: 02, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: threads a new endpoint kind through SettingsContext, per-prompt routing and the Request Transport, which are dense and heavily tested; window, capability and credential mistakes break every turn.

**What to build:** a Supporter selects the built-in **Formamorph AI** preset and plays full turns on it. Its window, capabilities and served model come only from the hosted state; the client never probes it. Every refusal maps to a preset state with its reason and action. Usage display, warnings, the exhausted flow and the one-time switch come in ticket 08.

- [ ] A virtual built-in preset appears next to Demo AI, never stored, with no Extra Parameters; its endpoint, model and window can't be edited.
- [ ] Its window comes only from the hosted state, active or routed, never from the context-detect cache; the client budgets prompts to the window minus the server's margin; `window_exceeded` refetches the hosted state.
- [ ] Its capabilities come only from the hosted state; no capability or context probe is sent for it; capability is cached by the hosted state's `model.id` (the approved entry's id, per ticket 06).
- [ ] The credential is read from the auth service at send time; a sign-out mid-turn never sends the old token (test).
- [ ] Every call of a turn, background passes included, carries the server-issued turn id.
- [ ] Each refusal code and the existing `protect` refusals map to the spec's preset states; the client's code list matches the server's list from ticket 03 in a pinned test.
- [ ] Per-prompt routing knows the new built-in id; a pass pinned to another preset keeps it; a pass pinned to Formamorph AI in a non-ready state fails once per turn with the state message.
- [ ] Background passes never raise their own toast for a hosted refusal.
- [ ] Locked, signed-out, age-gate, paused, outdated and unavailable states render with their action, with dev-route entries; frames in both themes at desktop width: `.scratch/frames/fai-locked-light.png`, `.scratch/frames/fai-locked-dark.png`, `.scratch/frames/fai-paused-dark.png`.
- [ ] Seam 3 tests run the Request Transport and SettingsContext against a fake proxy with the existing SSE fixtures.
- [ ] The client `CONTEXT.md` glossary gains entries for Formamorph AI and Hosted state.
- [ ] A changelog fragment states what a Supporter gets; no export shape changes.
- [ ] Help-window calls on Formamorph AI go through the same path and carry their own turn id.

For you: play a few turns on Formamorph AI against a staging server and judge whether it feels like any other preset.
