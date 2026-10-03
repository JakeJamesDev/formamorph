# 12: Compare to Default

Status: done
Base: abd4cf3b
Blocked by: 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A custom help preset does not get updates to the default prompts. A power user sees the difference (Q23).

- Each prompt of a custom preset has a **Compare to Default** action.
- It opens the prompt diff viewer with the custom text against the current default text.
- A prompt that equals the default shows the action in its unavailable state.
- Chips draw as chips on both sides.

The Prompts docs section gains the action.

Recommended model rationale: a reuse of a shipped viewer with one new caller.

## Acceptance criteria

- [ ] The action opens the diff viewer with the two texts, and the viewer shows above the modal.
- [ ] A prompt equal to the default has the action unavailable.
- [ ] The chip sentinels of the help chips pass through the viewer intact (the viewer's two known sentinel traps have tests here).
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
