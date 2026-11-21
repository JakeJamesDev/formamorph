# 05: Layer Transitions

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A Variant change animates with the Layer's transition, reusing the Mascot's. The spec covers this in Q16, Q17, Q19, Q20.

- **Shape.** A Layer gains a transition in the Mascot transition shape, default Dissolve with the Mascot's default tuning.
- **Diff.** A pure function of two resolved stacks: which Layers changed, which fade, and which Jelly tuning squashes (the topmost changed Jelly Layer). Tested on its own.
- **Render.** Dissolve fades only that Layer from the old Variant to the new one. Jelly squashes the whole picture once per change, while Dissolve Layers fade during it. Timing reuses the Mascot's pure timing function and ranges.
- **Reduced motion.** Jelly plays as Dissolve.
- **Editor.** The Mascot's mode switcher and tuning sliders per Layer, with a labeled Play button beside the mode switcher (Q35).
- Plain image swaps stay as they are (Q18).
- **Docs.** The World Editor Media page describes transitions.

## Acceptance criteria

- [x] The diff function's tests cover one change, several changes with mixed modes, and no change. `src/lib/layeredTransition.test.ts`; the render side of a mixed change is in `PictureImg.test.tsx` ("fades a Dissolve Layer during the one squash…").
- [x] A Dissolve change fades only its Layer, and a Jelly change squashes the whole picture once, proven by Playwright per-frame sampling. `e2e/layer-transitions.spec.ts`, first two tests, on the `layeredEditor` route.
- [x] With reduced motion emulated, a Jelly Layer change samples as a fade with no scale change. Same spec, third test; it went red with the reduced-motion swap removed.
- [x] Changelog fragment written. `docs-internal/changelog.d/layered-images-05.md`.

For you: change an expression in play and judge whether Dissolve and Jelly feel right at their defaults (entity panel).

⚠️ Export shape: Layers gain a transition.

## Landed

**Not verified**
- History paging animates (Q35): no test pages history with a layered picture; it holds only while the entity panel keeps the picture mounted across pages.
- The memory cleanup in `useLayeredMotion` (fade values for old images, runs of deleted Layers) has no test; it is internal state no render reads.

**For you**
- Change an expression in play and judge whether Dissolve and Jelly feel right at their defaults (entity panel).
- The editor's eye toggle now fades a Layer out with its Dissolve, rather than hiding it at once. Say if it should hide at once.
- Desktop editor at 1366×768 with Jelly selected: the Layer settings take 514 px, so the Layer list above them shrinks to 138 px (about three rows, scrolling). Say if the settings should scroll instead.
