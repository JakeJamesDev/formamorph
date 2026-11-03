# 12: Tunable Formamorph AI

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: opens an existing panel on one more preset, with a stored-shape change and clear rules.

**What to build:** a player on Formamorph AI tunes the same sampler sliders and max output as on any other endpoint. The sliders start on the model's published values (Q50). Max output starts at today's value, and the player can set it anywhere from 1 to the cap in the hosted state (Q51). Extra Parameters, the endpoint, the model and the window stay locked.

- [ ] The Formamorph AI preset shows the sampler sliders under its status panel, using the existing controls and copy.
- [ ] A new device starts with Temperature 1.0, Top-p 0.95 and Top-k 64 turned on, and Repetition Penalty and Min-p off. An unpinned prompt sends those values. A prompt's pin and a prompt's own Custom value still win, with a test for each.
- [ ] A player's changes persist on the device and survive a reload. Reset returns the Q50 values.
- [ ] Max output on this preset is a number field with no off switch, because the proxy refuses a call with no `max_tokens`. A test covers the field's lower and upper bounds, and a cap below the default.
- [ ] The value sent is never above the hosted cap, including when the cap drops after the player set a higher value.
- [ ] A test proves Extra Parameters stay out of a Formamorph AI request. Removing the guard fails it.
- [ ] Demo AI behavior doesn't change, with a test.
- [ ] Frame at `.scratch/frames/hosted-tuning-1280.png`, in both themes.
- [ ] A changelog fragment states what changed for the player.

For you: the panel's look on the real preset.
