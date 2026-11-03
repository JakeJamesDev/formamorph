# 12: Tunable Formamorph AI

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: opens an existing panel on one more preset, with a stored-shape change and clear rules.

**What to build:** a player on Formamorph AI tunes the same sampler sliders and max output as on any other endpoint. The sliders start on the model's published values (Q50). Max output starts at today's value, and the player can set it anywhere from 1 to the cap in the hosted state (Q51). Extra Parameters, the endpoint, the model and the window stay locked.

- [x] The Formamorph AI preset shows the sampler sliders under its status panel, using the existing controls and copy. Dev route `fai-ready` in Advanced mode: DOM read and frames; `TextEndpointEditor.test.tsx` "shows the sampler sliders and Max Output".
- [x] A new device starts with Temperature 1.0, Top-p 0.95 and Top-k 64 turned on, and Repetition Penalty and Min-p off. An unpinned prompt sends those values. A prompt's pin and a prompt's own Custom value still win, with a test for each. `hostedTuning.test.ts`: published values, unpinned send, pin (`help`), Custom value.
- [x] A player's changes persist on the device and survive a reload. Reset returns the Q50 values. `hostedTuning.test.ts` codec round trip and `resetPreset`.
- [x] Max output on this preset is a number field with no off switch, because the proxy refuses a call with no `max_tokens`. A test covers the field's lower and upper bounds, and a cap below the default. Editor test (1 and cap clamp) and `hostedTuning.test.ts` (1, above default, cap below default).
- [x] The value sent is never above the hosted cap, including when the cap drops after the player set a higher value. `hostedTuning.test.ts`; fails with the `Math.min` removed.
- [x] A test proves Extra Parameters stay out of a Formamorph AI request. Removing the guard fails it. Proved: the request-layer guard removed turned "keeps Extra Parameters out of its request" red.
- [x] Demo AI behavior doesn't change, with a test. `hostedTuning.test.ts` "leaves the Demo AI as it was" (store and resolver level).
- [x] Frame at `.scratch/frames/hosted-tuning-1280.png`, in both themes. Stored as `hosted-tuning-1280-dark.jpg` and `hosted-tuning-1280-light.jpg` (the pane saves JPEG).
- [x] A changelog fragment states what changed for the player.

For you: the panel's look on the real preset.

## Landed

**Not verified**
- Gates and full suite: see the landing output.
- Max Output cap on a live server: the dev route has no hosted state, so the cap showed the 1,024 fallback. Tests cover the cap logic.
- `anatomyPreview.ts` reads the unclamped stored Max Output (`settings.maxTokens`) on Formamorph AI. Not changed here.

**For you**
- The panel's look on the real preset (Settings, Endpoints, Text, Advanced mode): `.scratch/first-time-flow-12/frames/hosted-tuning-1280-dark.jpg` and `-light.jpg`.
- The panel shows only in Advanced mode, like the other endpoints' samplers (Q56, spec session).
- Reset to Defaults has no confirm dialog. It resets samplers and Max Output only.
- Export shape: the settings store (`FORMAMORPH_textEndpointPresets`) gains `hostedSamplerOverrides` and `hostedMaxTokens`. No world or save change.

