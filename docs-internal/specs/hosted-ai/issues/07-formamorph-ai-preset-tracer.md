# 07: Formamorph AI Preset Tracer

Status: ready-for-human
Blocked by: 02, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: threads a new endpoint kind through SettingsContext, per-prompt routing and the Request Transport, which are dense and heavily tested; window, capability and credential mistakes break every turn.

**What to build:** a Supporter selects the built-in **Formamorph AI** preset and plays full turns on it. Its window, capabilities and served model come only from the hosted state; the client never probes it. Every refusal maps to a preset state with its reason and action. Usage display, warnings, the exhausted flow and the one-time switch come in ticket 08.

- [x] A virtual built-in preset appears next to Demo AI, never stored, with no Extra Parameters; its endpoint, model and window can't be edited. (textEndpointPresets.test: the Formamorph AI preset block; DOM read of the select)
- [x] Its window comes only from the hosted state, active or routed, never from the context-detect cache; the client budgets prompts to the window minus the server's margin; `window_exceeded` refetches the hosted state. (SettingsContext.hosted.test: active and routed window 23200; hostedAi.test: window less the margin; requestTransport.hosted.test: window_exceeded reads the state again)
- [x] Its capabilities come only from the hosted state; no capability or context probe is sent for it; capability is cached by the hosted state's `model.id` (the approved entry's id, per ticket 06). (SettingsContext.hosted.test: probes nothing, also with an open record; hostedAi.test: new model's record on a switch)
- [x] The credential is read from the auth service at send time; a sign-out mid-turn never sends the old token (test). (requestTransport.hosted.test: sign-out between calls and while a call waits at the turn gate)
- [x] Every call of a turn, background passes included, carries the server-issued turn id. (requestTransport.hosted.test: three parallel passes, the third silent; GameViewer keys pipeline passes by turn and background passes by attachTurnId; by reading)
- [x] Each refusal code and the existing `protect` refusals map to the spec's preset states; the client's code list matches the server's list from ticket 03 in a pinned test. (hostedAi.test: the refusal code list; requestTransport.hosted.test: each code and the protect refusals)
- [x] Per-prompt routing knows the new built-in id; a pass pinned to another preset keeps it; a pass pinned to Formamorph AI in a non-ready state fails once per turn with the state message. (SettingsContext.hosted.test: routed pass; requestTransport.hosted.test: blocking state, one message, no fetch)
- [x] Background passes never raise their own toast for a hosted refusal. (requestTransport.hosted.test: background refusal; a blocked state shows once per state change, per the spec ruling)
- [x] Locked, signed-out, age-gate, paused, outdated and unavailable states render with their action, with dev-route entries; frames in both themes at desktop width: `.scratch/frames/fai-locked-light.png`, `.scratch/frames/fai-locked-dark.png`, `.scratch/frames/fai-paused-dark.png`. (DOM reads of all eleven states on `fixture=fai-<state>`; the three frames)
- [x] Seam 3 tests run the Request Transport and SettingsContext against a fake proxy with the existing SSE fixtures. (requestTransport.hosted.test, SettingsContext.hosted.test)
- [x] The client `CONTEXT.md` glossary gains entries for Formamorph AI and Hosted state. (CONTEXT.md)
- [x] A changelog fragment states what a Supporter gets; no export shape changes. (docs-internal/changelog.d/hosted-ai-07.md; no world or save type changed)
- [x] Help-window calls on Formamorph AI go through the same path and carry their own turn id. (helpSession.hosted.test: two questions, two turns, pick and answer share each)

For you: play a few turns on Formamorph AI against a staging server and judge whether it feels like any other preset.

## Landed

**Not verified**
- A full turn against a real proxy. Every check ran against a fake proxy with the server's contract (FormamorphServer 8a45f46); no staging server was reachable from this session.
- The status block's actions (Sign In, Review Policy, Confirm Age, Join on Patreon, Update, Check Again) were rendered, not clicked through to their flows.

**For you**
- Play a few turns on Formamorph AI against a staging server and judge whether it feels like any other preset.
- The status block in each state: `#dev?modal=settings&tab=endpoints&subtab=text&fixture=fai-<state>`; frames at `.scratch/hosted-ai-07/frames/fai-locked-light.png`, `.scratch/hosted-ai-07/frames/fai-locked-dark.png`, `.scratch/hosted-ai-07/frames/fai-paused-dark.png`.
- The state copy in [hostedCopy.ts](../../../../src/lib/hostedAi/hostedCopy.ts) has not had a copy sweep; ticket 08 adds the usage copy beside it.
