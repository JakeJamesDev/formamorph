# 04: Body Layout Editor

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A new visual pattern with pointer work, touch and a new pure module.

Before you build, get the user's approval of variant B and both outlines through the `design-system` flow. Reference: branch `prototype/paperdoll` at `422d61ba9`, `src/managers/paperdollPrototype/`. The prototype code is a reference, so rewrite it.

## What to build

Each Body gets a Backdrop and one Slot Box per capacity unit, edited inside the Body's expanded row in variant B's layout: doll on the left, slot rows on the right, wrapping when narrow (Q23, Q46).

This ticket owns the **Body Layout module**, which is pure: box sync to entries, stacking order, snap lines and clamps. It also owns the Body and BodyEntry schema from the spec. `parseBodies` fills an absent Backdrop, aspect or box with the new-Body defaults.

Behavior: Q1, Q2, Q5, Q6, Q13–Q19, Q23, Q29, Q31–Q34, Q47. The Backdrop select offers Humanoid, Quadruped and Plain; ticket 05 adds Custom Image. Edits go through the Bodies setter, so History and Auto Save work.

Snap to Others' choice is an app setting with a default in the settings defaults. Add a Design System reference and a `devRoutes` entry. Update CONTEXT.md (Body Layout, Backdrop, Slot Box) and the wiki's Equipment page.

⚠️ This changes the world export shape. Remind the user in the landing report.

## Acceptance criteria

- [x] A new Body starts on Humanoid with a small center square per capacity unit. `bodyLayout.test.ts` new boxes; `WorldEditor.equipment.test.tsx` adds a Body.
- [x] Raising capacity adds a center box, and lowering it drops the last. `withCapacity` tests; the bench's capacity tests.
- [x] Dragging moves a box and corner handles resize it, clamped inside the Backdrop with a minimum size. `e2e/body-layout.spec.ts`, both viewports.
- [x] Dragging the bottom edge changes the aspect, and boxes keep their fractions. Same spec, fractions read from real boxes.
- [x] Snap to Others aligns to box edges and centers and the vertical midline. Alt skips it for one drag. The toggle is remembered. `snapLines` and `dragMove` tests; the spec's snap, Alt and reload tests.
- [x] Arrow keys move a selected box, and Shift + arrow keys resize it. Bench test.
- [x] A smaller box draws above a larger one, and equal areas follow entry then unit order. `stackOrder` tests.
- [x] A selected large box leaves a small box inside it clickable, and the handles still take the pointer. Spec hit test.
- [x] Selecting a box selects its entry row, and the reverse. Bench tests, including Q52's unit cycling.
- [x] Boxes are labeled "Hand 1", "Hand 2", or "Head" at capacity 1. Bench test.
- [x] Duplicating a Body copies its Backdrop and boxes. Bench test.
- [x] A Playwright spec drives a real drag, a handle resize and a snap. `e2e/body-layout.spec.ts`, 16 passed and 2 skipped by project, plus real touch through CDP.
- [x] Frames saved as `.scratch/frames/body-layout-editor-<theme>-<width>.png` in light and dark, at 1440 and 375 wide. Read by eye.

## Landed

**Not verified**

- Touch on a real device. The spec sends touch through Chromium's CDP, not a finger.

**For you**

- Equipment Settings: does laying out a Humanoid feel good with mouse and with touch?
- Frames: `.scratch/body-layouts-and-slot-rules-04/frames/body-layout-editor-light-1440.png`, `.scratch/body-layouts-and-slot-rules-04/frames/body-layout-quadruped-dark-1440.png`.
- Capacity now stops at 99, because each unit draws a box (Q68).
- ⚠️ The world export shape changed: `backdrop` and `aspect` on a Body, `boxes` on an entry.
