# 05: Layer Transitions

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A Variant change animates with the Layer's transition, reusing the Mascot's. The spec covers this in Q16, Q17, Q19, Q20.

- **Shape.** A Layer gains a transition in the Mascot transition shape, default Dissolve with the Mascot's default tuning.
- **Diff.** A pure function of two resolved stacks: which Layers changed, which fade, and which Jelly tuning squashes (the topmost changed Jelly Layer). Tested on its own.
- **Render.** Dissolve fades only that Layer from the old Variant to the new one. Jelly squashes the whole picture once per change, while Dissolve Layers fade during it. Timing reuses the Mascot's pure timing function and ranges.
- **Reduced motion.** Jelly plays as Dissolve.
- **Editor.** The Mascot's mode switcher and tuning sliders per Layer, with a Play button in the preview.
- Plain image swaps stay as they are (Q18).
- **Docs.** The World Editor Media page describes transitions.

## Acceptance criteria

- [ ] The diff function's tests cover one change, several changes with mixed modes, and no change.
- [ ] A Dissolve change fades only its Layer, and a Jelly change squashes the whole picture once, proven by Playwright per-frame sampling.
- [ ] With reduced motion emulated, a Jelly Layer change samples as a fade with no scale change.
- [ ] Changelog fragment written.

For you: change an expression in play and judge whether Dissolve and Jelly feel right at their defaults (entity panel).

⚠️ Export shape: Layers gain a transition.
